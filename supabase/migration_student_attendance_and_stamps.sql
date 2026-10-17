-- ====================================================================
-- MIGRATION: STUDENT ATTENDANCE, 4-STAMP REWARD SYSTEM, AND APPROVALS
-- خدمة بنات إعدادي - منظومة الحضور الذكي وكارت الأختام
-- ====================================================================

-- 1. إضافة أعمدة الربط في profiles إن لم تكن موجودة
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='child_id') THEN
        ALTER TABLE public.profiles ADD COLUMN child_id UUID REFERENCES public.children(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='stage_id') THEN
        ALTER TABLE public.profiles ADD COLUMN stage_id UUID REFERENCES public.stages(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='family_id') THEN
        ALTER TABLE public.profiles ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. إنشاء جدول الحضور وتسجيل الأختام attendances
CREATE TABLE IF NOT EXISTS public.attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.stages(id) ON DELETE CASCADE,
    family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
    attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    attended_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_early BOOLEAN NOT NULL DEFAULT false,
    method TEXT NOT NULL DEFAULT 'qr', -- 'qr_self', 'qr_servant', 'manual'
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    points_awarded INTEGER NOT NULL DEFAULT 10,
    stamp_index INTEGER NOT NULL DEFAULT 1, -- 1, 2, 3, 4
    cycle_number INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_child_daily_attendance UNIQUE (child_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_attendances_child_id ON public.attendances(child_id);
CREATE INDEX IF NOT EXISTS idx_attendances_date ON public.attendances(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendances_stage_id ON public.attendances(stage_id);

-- 4. تمكين الحماية RLS لجدول attendances
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Attendances select policy" ON public.attendances;
CREATE POLICY "Attendances select policy" ON public.attendances
    FOR SELECT
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND (p.role = 'display' OR p.child_id = attendances.child_id)
        )
        OR public.servant_has_stage(attendances.stage_id)
        OR (attendances.family_id IS NOT NULL AND public.servant_has_family(attendances.family_id))
    );

DROP POLICY IF EXISTS "Attendances insert policy" ON public.attendances;
CREATE POLICY "Attendances insert policy" ON public.attendances
    FOR INSERT
    WITH CHECK (
        public.is_admin()
        OR public.servant_has_stage(stage_id)
        OR (family_id IS NOT NULL AND public.servant_has_family(family_id))
        OR (
            -- المخدومة تسجل لنفسها فقط إذا كان الحساب مرتبط بنفس الطفل
            EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid() 
                  AND p.role = 'student'
                  AND p.is_approved = true
                  AND p.child_id = attendances.child_id
            )
        )
    );

DROP POLICY IF EXISTS "Attendances admin policy" ON public.attendances;
CREATE POLICY "Attendances admin policy" ON public.attendances
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 5. دالة تسجيل الحضور الآمنة الذكية ومنع التكرار واحتساب الختم والنقاط
CREATE OR REPLACE FUNCTION public.record_student_attendance(
    target_child_id UUID,
    attendance_method TEXT DEFAULT 'qr_self',
    force_early BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_child RECORD;
    today_date DATE := CURRENT_DATE;
    existing_att RECORD;
    prev_count INT;
    new_stamp_idx INT;
    new_cycle INT;
    is_early_val BOOLEAN;
    points_to_add INT := 10;
    current_hour INT;
    current_min INT;
    new_att_id UUID;
    acting_user UUID := auth.uid();
BEGIN
    -- 1. التأكد من وجود الطفل وجلب بيانات مرحلته وأسرته
    SELECT c.*, f.stage_id as fam_stage_id 
    INTO target_child 
    FROM public.children c
    LEFT JOIN public.families f ON f.id = c.family_id
    WHERE c.id = target_child_id;

    IF target_child IS NULL THEN
        RAISE EXCEPTION 'المخدوم غير موجود بالخدمة';
    END IF;

    -- 2. التحقق من عدم وجود تسجيل مسبق في نفس اليوم
    SELECT * INTO existing_att 
    FROM public.attendances 
    WHERE child_id = target_child_id AND attendance_date = today_date;

    IF existing_att IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'already_registered', true,
            'message', 'تم تسجيل الحضور اليوم بالفعل في تمام الساعة ' || to_char(existing_att.attended_at, 'HH12:MI AM'),
            'attendance', to_jsonb(existing_att)
        );
    END IF;

    -- 3. احتساب الحضور بدري (افتراضياً: قبل الساعة 09:15 صباحاً، أو حسب القيمة المحددة)
    IF force_early IS NOT NULL THEN
        is_early_val := force_early;
    ELSE
        -- فحص الوقت الحالي
        current_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Africa/Cairo'));
        current_min := EXTRACT(MINUTE FROM (now() AT TIME ZONE 'Africa/Cairo'));
        -- حضور بدري إذا كان قبل الساعة 9:15 صباحاً (أو في الفترة الصباحية المبكرة)
        IF (current_hour < 9) OR (current_hour = 9 AND current_min <= 15) THEN
            is_early_val := true;
        ELSE
            is_early_val := false;
        END IF;
    END IF;

    -- نقاط الحضور: 10 حضور عادي + 10 بونص حضور بدري = 20
    IF is_early_val THEN
        points_to_add := 20;
    ELSE
        points_to_add := 10;
    END IF;

    -- 4. احتساب رقم الختم ودورة الأختام
    SELECT COUNT(*) INTO prev_count 
    FROM public.attendances 
    WHERE child_id = target_child_id;

    new_cycle := (prev_count / 4) + 1;
    new_stamp_idx := (prev_count % 4) + 1;

    -- 5. حفظ سجل الحضور
    INSERT INTO public.attendances (
        child_id,
        stage_id,
        family_id,
        attendance_date,
        attended_at,
        is_early,
        method,
        recorded_by,
        points_awarded,
        stamp_index,
        cycle_number
    ) VALUES (
        target_child_id,
        target_child.stage_id,
        target_child.family_id,
        today_date,
        now(),
        is_early_val,
        attendance_method,
        acting_user,
        points_to_add,
        new_stamp_idx,
        new_cycle
    ) RETURNING id INTO new_att_id;

    -- 6. تسجيل النقاط في سجل النقاط point_logs ليظهر في لوحة الصدارة
    INSERT INTO public.point_logs (
        child_id,
        family_id,
        stage_id,
        points,
        reason,
        servant_id,
        created_at
    ) VALUES (
        target_child_id,
        target_child.family_id,
        target_child.stage_id,
        points_to_add,
        CASE WHEN is_early_val THEN 'حضور بدري ممتاز (ختم كارت إعدادي)' ELSE 'حضور الخدمة (ختم كارت إعدادي)' END,
        COALESCE(acting_user, (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)),
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'already_registered', false,
        'attendance_id', new_att_id,
        'stamp_index', new_stamp_idx,
        'cycle_number', new_cycle,
        'is_early', is_early_val,
        'points_awarded', points_to_add,
        'completed_card', (new_stamp_idx = 4),
        'message', CASE 
            WHEN new_stamp_idx = 4 THEN '🎉 مبروك! جمعتِ ٤ أختام بدون غياب، استلمي هديتك من الخادم 🎁'
            WHEN is_early_val THEN '✨ تم تسجيل الحضور بدري بنجاح (+20 نقطة) وطباعة الختم رقم (' || new_stamp_idx || ')!'
            ELSE '✓ تم تسجيل الحضور بنجاح (+10 نقاط) وطباعة الختم رقم (' || new_stamp_idx || ')!'
        END
    );
END;
$$;

-- 6. دالة اعتماد حسابات المخدومين والطلاب بواسطة الأدمن أو خادم المرحلة
CREATE OR REPLACE FUNCTION public.approve_student_account(target_user_id UUID, linked_child_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_prof RECORD;
    chosen_child RECORD;
BEGIN
    SELECT * INTO target_prof FROM public.profiles WHERE id = target_user_id;
    IF target_prof IS NULL THEN
        RAISE EXCEPTION 'حساب المستخدم غير موجود';
    END IF;

    -- التحقق من الصلاحيات: الأدمن أو خادم المرحلة
    IF NOT (
        public.is_admin() OR 
        (
            target_prof.role = 'student' AND 
            (
                (target_prof.stage_id IS NOT NULL AND public.servant_has_stage(target_prof.stage_id)) OR
                (target_prof.family_id IS NOT NULL AND public.servant_has_family(target_prof.family_id))
            )
        )
    ) THEN
        RAISE EXCEPTION 'ليس لديك صلاحية اعتماد هذا الحساب، الصلاحية للأدمن أو خادم المرحلة المختصة';
    END IF;

    -- إذا تم تحديد طفل للربط
    IF linked_child_id IS NOT NULL THEN
        SELECT * INTO chosen_child FROM public.children WHERE id = linked_child_id;
        IF chosen_child IS NOT NULL THEN
            UPDATE public.profiles
            SET child_id = chosen_child.id,
                stage_id = chosen_child.stage_id,
                family_id = chosen_child.family_id
            WHERE id = target_user_id;
        END IF;
    END IF;

    -- اعتماد الحساب وتأكيد الدخول
    UPDATE public.profiles
    SET is_approved = true, updated_at = now()
    WHERE id = target_user_id;

    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE id = target_user_id;
END;
$$;

-- 7. تحديث دالة تسجيل المستخدم الجديد handle_new_user لدعم role = 'student'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_profiles INT;
    user_name TEXT;
    requested_role TEXT;
    fam_str TEXT;
    stg_str TEXT;
    target_fid UUID;
    target_sid UUID;
    created_child_id UUID;
    existing_child_id UUID;
BEGIN
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم جديد');
    requested_role := COALESCE(NEW.raw_user_meta_data->>'role', 'servant');
    
    SELECT COUNT(*) INTO total_profiles FROM public.profiles;

    -- أول حساب في النظام يكون أدمن دائماً
    IF total_profiles = 0 THEN
        INSERT INTO public.profiles (id, email, full_name, role, is_approved)
        VALUES (
            NEW.id,
            NEW.email,
            user_name,
            'admin',
            true
        )
        ON CONFLICT (id) DO UPDATE SET role = 'admin', is_approved = true;
    ELSE
        -- قراءة المرحلة والأسرة من الميتا داتا
        fam_str := NEW.raw_user_meta_data->>'requested_family_id';
        stg_str := NEW.raw_user_meta_data->>'requested_stage_id';
        
        IF fam_str IS NOT NULL AND fam_str ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            target_fid := fam_str::uuid;
        END IF;
        IF stg_str IS NOT NULL AND stg_str ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            target_sid := stg_str::uuid;
        END IF;

        IF requested_role = 'student' THEN
            -- إذا كان التسجيل لطالب/مخدوم
            -- محاولة العثور على طفل مسجل بنفس الاسم أو إنشاء ملف طفل له
            IF target_fid IS NOT NULL THEN
                SELECT id INTO existing_child_id FROM public.children 
                WHERE family_id = target_fid AND full_name ILIKE user_name LIMIT 1;
            END IF;

            -- إذا لم يوجد، ننشئ سجل في جدول الأطفال
            IF existing_child_id IS NULL AND target_fid IS NOT NULL AND target_sid IS NOT NULL THEN
                INSERT INTO public.children (full_name, stage_id, family_id, is_active)
                VALUES (user_name, target_sid, target_fid, true)
                RETURNING id INTO created_child_id;
                existing_child_id := created_child_id;
            END IF;

            INSERT INTO public.profiles (id, email, full_name, role, is_approved, child_id, stage_id, family_id)
            VALUES (
                NEW.id,
                NEW.email,
                user_name,
                'student',
                false,
                existing_child_id,
                target_sid,
                target_fid
            )
            ON CONFLICT (id) DO NOTHING;

        ELSE
            -- خادم عادي
            INSERT INTO public.profiles (id, email, full_name, role, is_approved, family_id, stage_id)
            VALUES (
                NEW.id,
                NEW.email,
                user_name,
                'servant',
                false,
                target_fid,
                target_sid
            )
            ON CONFLICT (id) DO NOTHING;

            IF target_fid IS NOT NULL THEN
                INSERT INTO public.family_servants (family_id, servant_id)
                VALUES (target_fid, NEW.id)
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user exception: %', SQLERRM;
    RETURN NEW;
END;
$$;
