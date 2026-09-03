-- ==============================================================================
-- ⛪ مشروع: خدمة مدارس الأحد
-- Database Schema & Security Migration for Supabase
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CUSTOM TYPES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'servant', 'display');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE point_rule_type AS ENUM ('add', 'deduct');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'servant',
    is_approved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. STAGES TABLE (المراحل)
CREATE TABLE IF NOT EXISTS public.stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. FAMILIES TABLE (الأسر)
CREATE TABLE IF NOT EXISTS public.families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES public.stages(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. FAMILY_SERVANTS TABLE (ربط الخدام بالأسر)
CREATE TABLE IF NOT EXISTS public.family_servants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    servant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_family_servant UNIQUE (family_id, servant_id)
);

-- 7. CHILDREN TABLE (الأولاد / المخدومين)
CREATE TABLE IF NOT EXISTS public.children (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT,
    full_name TEXT NOT NULL,
    image_url TEXT,
    stage_id UUID NOT NULL REFERENCES public.stages(id) ON DELETE RESTRICT,
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. POINT_RULES TABLE (قواعد النقاط الديناميكية)
CREATE TABLE IF NOT EXISTS public.point_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    points INT NOT NULL,
    type point_rule_type NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    target_stage_id UUID REFERENCES public.stages(id) ON DELETE SET NULL,
    target_family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. POINT_LOGS TABLE (سجل العمليات الدائم والتدقيق)
CREATE TABLE IF NOT EXISTS public.point_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID REFERENCES public.children(id) ON DELETE CASCADE, -- NULLABLE: يسمح بإضافة نقاط مباشرة للأسرة من قبل الأدمن
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.stages(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES public.point_rules(id) ON DELETE SET NULL,
    points INT NOT NULL,
    reason TEXT NOT NULL,
    servant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    is_reverted BOOLEAN NOT NULL DEFAULT false,
    reverted_at TIMESTAMPTZ,
    revert_reason TEXT,
    reverted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. INDEXES FOR HIGH PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_families_stage_id ON public.families(stage_id);
CREATE INDEX IF NOT EXISTS idx_children_family_id ON public.children(family_id);
CREATE INDEX IF NOT EXISTS idx_children_stage_id ON public.children(stage_id);
CREATE INDEX IF NOT EXISTS idx_children_is_active ON public.children(is_active);
CREATE INDEX IF NOT EXISTS idx_family_servants_servant ON public.family_servants(servant_id);
CREATE INDEX IF NOT EXISTS idx_family_servants_family ON public.family_servants(family_id);
CREATE INDEX IF NOT EXISTS idx_point_logs_created_at ON public.point_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_logs_child_id ON public.point_logs(child_id);
CREATE INDEX IF NOT EXISTS idx_point_logs_family_id ON public.point_logs(family_id);
CREATE INDEX IF NOT EXISTS idx_point_logs_servant_id ON public.point_logs(servant_id);

-- 11. SECURITY & HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
DECLARE
    u_role user_role;
BEGIN
    SELECT role INTO u_role 
    FROM public.profiles 
    WHERE id = auth.uid() AND is_approved = true;
    RETURN u_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin' AND is_approved = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_approved_user()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_approved = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.servant_has_family(target_family_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF public.is_admin() THEN
        RETURN true;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.family_servants 
        WHERE servant_id = auth.uid() AND family_id = target_family_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.servant_has_child(target_child_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF public.is_admin() THEN
        RETURN true;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.children c
        JOIN public.family_servants fs ON fs.family_id = c.family_id
        WHERE c.id = target_child_id AND fs.servant_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 12. AUTOMATIC PROFILE CREATION TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_profiles INT;
    user_name TEXT;
    fam_str TEXT;
    target_fid UUID;
BEGIN
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم جديد');
    SELECT COUNT(*) INTO total_profiles FROM public.profiles;

    IF total_profiles = 0 THEN
        INSERT INTO public.profiles (id, email, full_name, role, is_approved)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', 'مدير النظام الأول'),
            'admin',
            true
        )
        ON CONFLICT (id) DO UPDATE SET role = 'admin', is_approved = true;
    ELSE
        INSERT INTO public.profiles (id, email, full_name, role, is_approved)
        VALUES (
            NEW.id,
            NEW.email,
            user_name,
            'servant',
            false
        )
        ON CONFLICT (id) DO NOTHING;

        -- ربط الخادم بالأسرة المختارة أثناء التسجيل بأمان تام
        fam_str := NEW.raw_user_meta_data->>'requested_family_id';
        IF fam_str IS NOT NULL AND fam_str ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            BEGIN
                target_fid := fam_str::uuid;
                IF EXISTS (SELECT 1 FROM public.families WHERE id = target_fid) THEN
                    INSERT INTO public.family_servants (family_id, servant_id)
                    VALUES (target_fid, NEW.id)
                    ON CONFLICT DO NOTHING;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                NULL;
            END;
        END IF;
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user exception: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- دالة اعتماد الخادم وتأكيد حسابه فوراً في auth.users
CREATE OR REPLACE FUNCTION public.approve_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'فقط مسؤولو الخدمة (Admins) يملكون صلاحية اعتماد الخدام';
    END IF;

    -- 1. اعتماد في جدول profiles
    UPDATE public.profiles
    SET is_approved = true, updated_at = now()
    WHERE id = target_user_id;

    -- 2. تأكيد البريد تلقائياً في auth.users لتمكينه من الدخول فوراً
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE id = target_user_id;
END;
$$;

-- 13. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_servants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_logs ENABLE ROW LEVEL SECURITY;

-- ----------------- PROFILES POLICIES -----------------
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
CREATE POLICY "Profiles select policy" ON public.profiles
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
CREATE POLICY "Profiles update policy" ON public.profiles
    FOR UPDATE
    USING (
        public.is_admin() OR id = auth.uid()
    )
    WITH CHECK (
        public.is_admin() OR (
            id = auth.uid() 
            AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
            AND is_approved = (SELECT is_approved FROM public.profiles WHERE id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;
CREATE POLICY "Profiles insert policy" ON public.profiles
    FOR INSERT
    WITH CHECK (public.is_admin() OR id = auth.uid());

DROP POLICY IF EXISTS "Profiles delete policy" ON public.profiles;
CREATE POLICY "Profiles delete policy" ON public.profiles
    FOR DELETE
    USING (public.is_admin());

-- ----------------- STAGES POLICIES -----------------
DROP POLICY IF EXISTS "Stages select policy" ON public.stages;
CREATE POLICY "Stages select policy" ON public.stages
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Stages admin manage policy" ON public.stages;
CREATE POLICY "Stages admin manage policy" ON public.stages
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ----------------- FAMILIES POLICIES -----------------
DROP POLICY IF EXISTS "Families select policy" ON public.families;
CREATE POLICY "Families select policy" ON public.families
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Families admin manage policy" ON public.families;
CREATE POLICY "Families admin manage policy" ON public.families
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ----------------- FAMILY_SERVANTS POLICIES -----------------
DROP POLICY IF EXISTS "Family servants select policy" ON public.family_servants;
CREATE POLICY "Family servants select policy" ON public.family_servants
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Family servants admin manage policy" ON public.family_servants;
CREATE POLICY "Family servants admin manage policy" ON public.family_servants
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ----------------- CHILDREN POLICIES -----------------
DROP POLICY IF EXISTS "Children select policy" ON public.children;
CREATE POLICY "Children select policy" ON public.children
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Children insert policy" ON public.children;
CREATE POLICY "Children insert policy" ON public.children
    FOR INSERT
    WITH CHECK (
        public.is_admin() OR (
            public.is_approved_user() AND 
            public.servant_has_family(family_id)
        )
    );

DROP POLICY IF EXISTS "Children update policy" ON public.children;
CREATE POLICY "Children update policy" ON public.children
    FOR UPDATE
    USING (
        public.is_admin() OR (
            public.is_approved_user() AND 
            public.servant_has_family(family_id)
        )
    )
    WITH CHECK (
        public.is_admin() OR (
            public.is_approved_user() AND 
            public.servant_has_family(family_id)
        )
    );

DROP POLICY IF EXISTS "Children delete policy" ON public.children;
CREATE POLICY "Children delete policy" ON public.children
    FOR DELETE
    USING (public.is_admin());

-- ----------------- POINT_RULES POLICIES -----------------
DROP POLICY IF EXISTS "Point rules select policy" ON public.point_rules;
CREATE POLICY "Point rules select policy" ON public.point_rules
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Point rules admin manage policy" ON public.point_rules;
CREATE POLICY "Point rules admin manage policy" ON public.point_rules
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ----------------- POINT_LOGS POLICIES -----------------
DROP POLICY IF EXISTS "Point logs select policy" ON public.point_logs;
CREATE POLICY "Point logs select policy" ON public.point_logs
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Point logs insert policy" ON public.point_logs;
CREATE POLICY "Point logs insert policy" ON public.point_logs
    FOR INSERT
    WITH CHECK (
        public.is_admin() OR (
            public.is_approved_user() 
            AND servant_id = auth.uid()
            AND child_id IS NOT NULL
            AND public.servant_has_family(family_id)
        )
    );

DROP POLICY IF EXISTS "Point logs update policy (revert)" ON public.point_logs;
CREATE POLICY "Point logs update policy (revert)" ON public.point_logs
    FOR UPDATE
    USING (
        public.is_admin() OR (
            servant_id = auth.uid() 
            AND is_reverted = false
        )
    )
    WITH CHECK (
        public.is_admin() OR (
            servant_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Point logs delete policy" ON public.point_logs;
CREATE POLICY "Point logs delete policy" ON public.point_logs
    FOR DELETE
    USING (public.is_admin());

-- 14. REALTIME CONFIGURATION (FULL REPLICA IDENTITY & 7 TABLES PUBLICATION)
-- ضبط REPLICA IDENTITY FULL لضمان إرسال كامل البيانات السابقة والجديدة في UPDATE و DELETE
ALTER TABLE public.children REPLICA IDENTITY FULL;
ALTER TABLE public.families REPLICA IDENTITY FULL;
ALTER TABLE public.stages REPLICA IDENTITY FULL;
ALTER TABLE public.point_logs REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.family_servants REPLICA IDENTITY FULL;
ALTER TABLE public.point_rules REPLICA IDENTITY FULL;

-- إتاحة الاستماع الفوري لكل الجداول الـ 7 في منشور supabase_realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.children; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.families; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.stages; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.point_logs; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.family_servants; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.point_rules; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 15. STORAGE BUCKET FOR PHOTOS
INSERT INTO storage.buckets (id, name, public) 
VALUES ('sunday_school_media', 'sunday_school_media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public access to sunday school media" ON storage.objects;
CREATE POLICY "Public access to sunday school media" ON storage.objects
    FOR SELECT USING (bucket_id = 'sunday_school_media');

DROP POLICY IF EXISTS "Authenticated users upload media" ON storage.objects;
CREATE POLICY "Authenticated users upload media" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'sunday_school_media' 
        AND auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "Authenticated users update media" ON storage.objects;
CREATE POLICY "Authenticated users update media" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'sunday_school_media' 
        AND auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "Users can delete media" ON storage.objects;
CREATE POLICY "Users can delete media" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'sunday_school_media' 
        AND (public.is_admin() OR auth.role() = 'authenticated')
    );

-- ==============================================================================
-- 16. SEED DATA (البيانات الابتدائية)
-- ==============================================================================

-- إضافة المراحل الثلاث المطلوبة (1 ابتدائي، 2 ابتدائي، 3 ابتدائي)
INSERT INTO public.stages (name, sort_order, is_active)
VALUES 
    ('1 ابتدائي', 1, true),
    ('2 ابتدائي', 2, true),
    ('3 ابتدائي', 3, true)
ON CONFLICT (name) DO NOTHING;

-- إضافة قواعد النقاط الابتدائية الـ 9 المذكورة في المواصفات
INSERT INTO public.point_rules (title, points, type, description, is_active)
VALUES
    ('الحضور بدري', 3, 'add', 'الحضور المبكر للخدمة وتشجيع الالتزام', true),
    ('الحضور في المعاد', 1, 'add', 'الوصول في الموعد المحدد', true),
    ('الهدوء', 2, 'add', 'الهدوء والتركيز أثناء الدرس والأنشطة', true),
    ('إجابة سؤال', 2, 'add', 'التفاعل والمشاركة في إجابة الأسئلة', true),
    ('حفظ آية', 3, 'add', 'تسميع آية الدرس المقررة', true),
    ('المشاركة', 1, 'add', 'المشاركة الفعالة في صلوات وفقرات الخدمة', true),
    ('التأخير', -1, 'deduct', 'التأخر عن موعد بداية القداس أو الخدمة', true),
    ('الدوشة', -2, 'deduct', 'عدم الالتزام وإحداث فوضى أو مقاطعة الخادم', true),
    ('الغياب', -3, 'deduct', 'الغياب بدون إذن مسبق', true)
ON CONFLICT DO NOTHING;
