-- ==============================================================================
-- ⛪ ترقية أمان وقاعدة بيانات: إدارة المراحل والمجموعات وعزل الصلاحيات (RLS)
-- نفّذ هذا الملف في Supabase SQL Editor
-- ==============================================================================

-- 1. إنشاء جدول المجموعات (groups)
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. جدول ربط المجموعات بالمراحل المتاحة لها (group_stages) - علاقة متعدد لمتعدد
CREATE TABLE IF NOT EXISTS public.group_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.stages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_group_stage UNIQUE (group_id, stage_id)
);

-- 3. جدول ربط الخدام بالمجموعات (group_servants)
CREATE TABLE IF NOT EXISTS public.group_servants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    servant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_group_servant UNIQUE (group_id, servant_id)
);

-- 4. فهارس لسرعة الاستعلام
CREATE INDEX IF NOT EXISTS idx_group_stages_group ON public.group_stages(group_id);
CREATE INDEX IF NOT EXISTS idx_group_stages_stage ON public.group_stages(stage_id);
CREATE INDEX IF NOT EXISTS idx_group_servants_servant ON public.group_servants(servant_id);
CREATE INDEX IF NOT EXISTS idx_group_servants_group ON public.group_servants(group_id);

-- 5. ضمان وجود المراحل الثلاث الأساسية المطلوبة: ابتدائي، إعدادي، ثانوي
INSERT INTO public.stages (name, sort_order, is_active)
VALUES 
    ('ابتدائي', 1, true),
    ('إعدادي', 2, true),
    ('ثانوي', 3, true)
ON CONFLICT (name) DO UPDATE SET is_active = true;

-- ترحيل آمن لأي بيانات سابقة كانت مرتبطة بـ 1 أو 2 أو 3 ابتدائي إلى مرحلة 'ابتدائي'
DO $$
DECLARE
    prim_stage_id UUID;
BEGIN
    SELECT id INTO prim_stage_id FROM public.stages WHERE name = 'ابتدائي' LIMIT 1;
    IF prim_stage_id IS NOT NULL THEN
        UPDATE public.families 
        SET stage_id = prim_stage_id 
        WHERE stage_id IN (SELECT id FROM public.stages WHERE name IN ('1 ابتدائي', '2 ابتدائي', '3 ابتدائي') AND id <> prim_stage_id);

        UPDATE public.children 
        SET stage_id = prim_stage_id 
        WHERE stage_id IN (SELECT id FROM public.stages WHERE name IN ('1 ابتدائي', '2 ابتدائي', '3 ابتدائي') AND id <> prim_stage_id);

        UPDATE public.point_logs 
        SET stage_id = prim_stage_id 
        WHERE stage_id IN (SELECT id FROM public.stages WHERE name IN ('1 ابتدائي', '2 ابتدائي', '3 ابتدائي') AND id <> prim_stage_id);

        UPDATE public.point_rules 
        SET target_stage_id = prim_stage_id 
        WHERE target_stage_id IN (SELECT id FROM public.stages WHERE name IN ('1 ابتدائي', '2 ابتدائي', '3 ابتدائي') AND id <> prim_stage_id);
    END IF;
END $$;

-- 6. إنشاء المجموعات الافتراضية وربط مراحلها
DO $$
DECLARE
    g_prim UUID;
    g_prep UUID;
    g_sec  UUID;
    s_prim UUID;
    s_prep UUID;
    s_sec  UUID;
BEGIN
    SELECT id INTO s_prim FROM public.stages WHERE name = 'ابتدائي' LIMIT 1;
    SELECT id INTO s_prep FROM public.stages WHERE name = 'إعدادي' LIMIT 1;
    SELECT id INTO s_sec  FROM public.stages WHERE name = 'ثانوي' LIMIT 1;

    -- إنشاء مجموعة ابتدائي
    INSERT INTO public.groups (name, description, is_active)
    VALUES ('مجموعة ابتدائي', 'خدمة مرحلة ابتدائي', true)
    ON CONFLICT (name) DO UPDATE SET is_active = true
    RETURNING id INTO g_prim;
    IF g_prim IS NULL THEN SELECT id INTO g_prim FROM public.groups WHERE name = 'مجموعة ابتدائي'; END IF;

    -- إنشاء مجموعة إعدادي
    INSERT INTO public.groups (name, description, is_active)
    VALUES ('مجموعة إعدادي', 'خدمة مرحلة إعدادي', true)
    ON CONFLICT (name) DO UPDATE SET is_active = true
    RETURNING id INTO g_prep;
    IF g_prep IS NULL THEN SELECT id INTO g_prep FROM public.groups WHERE name = 'مجموعة إعدادي'; END IF;

    -- إنشاء مجموعة ثانوي
    INSERT INTO public.groups (name, description, is_active)
    VALUES ('مجموعة ثانوي', 'خدمة مرحلة ثانوي', true)
    ON CONFLICT (name) DO UPDATE SET is_active = true
    RETURNING id INTO g_sec;
    IF g_sec IS NULL THEN SELECT id INTO g_sec FROM public.groups WHERE name = 'مجموعة ثانوي'; END IF;

    -- ربط المراحل بالمجموعات الافتراضية
    IF g_prim IS NOT NULL AND s_prim IS NOT NULL THEN
        INSERT INTO public.group_stages (group_id, stage_id) VALUES (g_prim, s_prim) ON CONFLICT DO NOTHING;
    END IF;
    IF g_prep IS NOT NULL AND s_prep IS NOT NULL THEN
        INSERT INTO public.group_stages (group_id, stage_id) VALUES (g_prep, s_prep) ON CONFLICT DO NOTHING;
    END IF;
    IF g_sec IS NOT NULL AND s_sec IS NOT NULL THEN
        INSERT INTO public.group_stages (group_id, stage_id) VALUES (g_sec, s_sec) ON CONFLICT DO NOTHING;
    END IF;

    -- إسناد الخدام الحاليين غير المعينين لمجموعة ابتدائي افتراضياً لضمان استمرارية الخدمة
    IF g_prim IS NOT NULL THEN
        INSERT INTO public.group_servants (group_id, servant_id)
        SELECT g_prim, p.id
        FROM public.profiles p
        WHERE p.role = 'servant'
          AND NOT EXISTS (
              SELECT 1 FROM public.group_servants gs WHERE gs.servant_id = p.id
          )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- 7. دوال التحقق الأمني لعزل البيانات في RLS
-- دالة التحقق مما إذا كان الخادم يملك صلاحية مرحلة معينة عبر مجموعاته النشطة
CREATE OR REPLACE FUNCTION public.servant_has_stage(target_stage_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- الأدمن يملك صلاحية الوصول لجميع المراحل
    IF public.is_admin() THEN
        RETURN true;
    END IF;

    -- إذا كان المستخدم غير مسجل الدخول
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    -- شاشات العرض المعتمدة
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'display' AND is_approved = true) THEN
        RETURN true;
    END IF;

    -- التحقق من انتماء الخادم لمجموعة نشطة مصرح لها بهذه المرحلة
    RETURN EXISTS (
        SELECT 1 
        FROM public.group_servants gs
        JOIN public.groups g ON g.id = gs.group_id
        JOIN public.group_stages gst ON gst.group_id = g.id
        WHERE gs.servant_id = auth.uid()
          AND g.is_active = true
          AND gst.stage_id = target_stage_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- دالة التحقق مما إذا كان الخادم يملك صلاحية مجموعة معينة
CREATE OR REPLACE FUNCTION public.servant_has_group(target_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF public.is_admin() THEN
        RETURN true;
    END IF;

    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1 
        FROM public.group_servants gs
        JOIN public.groups g ON g.id = gs.group_id
        WHERE gs.servant_id = auth.uid()
          AND gs.group_id = target_group_id
          AND g.is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 8. تفعيل سياسات الأمان على الجداول الجديدة
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_servants ENABLE ROW LEVEL SECURITY;

-- سياسات جدول المجموعات (groups)
DROP POLICY IF EXISTS "Groups select policy" ON public.groups;
CREATE POLICY "Groups select policy" ON public.groups
    FOR SELECT
    USING (
        public.is_admin() 
        OR public.servant_has_group(id)
        OR auth.role() = 'anon'
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'display')
    );

DROP POLICY IF EXISTS "Groups admin manage policy" ON public.groups;
CREATE POLICY "Groups admin manage policy" ON public.groups
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- سياسات جدول group_stages
DROP POLICY IF EXISTS "Group stages select policy" ON public.group_stages;
CREATE POLICY "Group stages select policy" ON public.group_stages
    FOR SELECT
    USING (
        public.is_admin() 
        OR public.servant_has_group(group_id)
        OR auth.role() = 'anon'
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'display')
    );

DROP POLICY IF EXISTS "Group stages admin manage policy" ON public.group_stages;
CREATE POLICY "Group stages admin manage policy" ON public.group_stages
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- سياسات جدول group_servants
DROP POLICY IF EXISTS "Group servants select policy" ON public.group_servants;
CREATE POLICY "Group servants select policy" ON public.group_servants
    FOR SELECT
    USING (
        public.is_admin() 
        OR servant_id = auth.uid()
        OR auth.role() = 'anon'
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'display')
    );

DROP POLICY IF EXISTS "Group servants admin manage policy" ON public.group_servants;
CREATE POLICY "Group servants admin manage policy" ON public.group_servants
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 9. تحديث سياسات RLS لضمان عزل البيانات 100% في المراحل والأولاد والنقاط والأسر
-- جدول المراحل (stages)
DROP POLICY IF EXISTS "Stages select policy" ON public.stages;
CREATE POLICY "Stages select policy" ON public.stages
    FOR SELECT
    USING (
        public.is_admin() 
        OR public.servant_has_stage(id)
        OR auth.role() = 'anon'
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'display')
    );

-- جدول الأسر (families)
DROP POLICY IF EXISTS "Families select policy" ON public.families;
CREATE POLICY "Families select policy" ON public.families
    FOR SELECT
    USING (
        public.is_admin() 
        OR public.servant_has_stage(stage_id)
        OR auth.role() = 'anon'
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'display')
    );

-- جدول الأولاد / المخدومين (children)
DROP POLICY IF EXISTS "Children select policy" ON public.children;
CREATE POLICY "Children select policy" ON public.children
    FOR SELECT
    USING (
        public.is_admin() 
        OR public.servant_has_stage(stage_id)
        OR auth.role() = 'anon'
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'display')
    );

DROP POLICY IF EXISTS "Children insert policy" ON public.children;
CREATE POLICY "Children insert policy" ON public.children
    FOR INSERT
    WITH CHECK (
        public.is_admin() OR (
            public.is_approved_user() AND 
            public.servant_has_stage(stage_id) AND
            public.servant_has_family(family_id)
        )
    );

DROP POLICY IF EXISTS "Children update policy" ON public.children;
CREATE POLICY "Children update policy" ON public.children
    FOR UPDATE
    USING (
        public.is_admin() OR (
            public.is_approved_user() AND 
            public.servant_has_stage(stage_id) AND
            public.servant_has_family(family_id)
        )
    )
    WITH CHECK (
        public.is_admin() OR (
            public.is_approved_user() AND 
            public.servant_has_stage(stage_id) AND
            public.servant_has_family(family_id)
        )
    );

-- جدول سجل النقاط (point_logs)
DROP POLICY IF EXISTS "Point logs select policy" ON public.point_logs;
CREATE POLICY "Point logs select policy" ON public.point_logs
    FOR SELECT
    USING (
        public.is_admin() 
        OR public.servant_has_stage(stage_id)
        OR auth.role() = 'anon'
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'display')
    );

DROP POLICY IF EXISTS "Point logs insert policy" ON public.point_logs;
CREATE POLICY "Point logs insert policy" ON public.point_logs
    FOR INSERT
    WITH CHECK (
        public.is_admin() OR (
            public.is_approved_user() 
            AND servant_id = auth.uid()
            AND public.servant_has_stage(stage_id)
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
            AND public.servant_has_stage(stage_id)
        )
    )
    WITH CHECK (
        public.is_admin() OR (
            servant_id = auth.uid()
            AND public.servant_has_stage(stage_id)
        )
    );

-- جدول قواعد النقاط (point_rules)
DROP POLICY IF EXISTS "Point rules select policy" ON public.point_rules;
CREATE POLICY "Point rules select policy" ON public.point_rules
    FOR SELECT
    USING (
        public.is_admin()
        OR target_stage_id IS NULL
        OR public.servant_has_stage(target_stage_id)
        OR auth.role() = 'anon'
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'display')
    );

-- 10. إعداد Realtime للمجموعات
ALTER TABLE public.groups REPLICA IDENTITY FULL;
ALTER TABLE public.group_stages REPLICA IDENTITY FULL;
ALTER TABLE public.group_servants REPLICA IDENTITY FULL;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.groups; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.group_stages; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.group_servants; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 11. جدول إعدادات البث المركزي لشاشات العرض (display_settings)
-- يتيح للأدمن التحكم المركزي فيما تعرضه كل الشاشات لحظياً عن بعد
CREATE TABLE IF NOT EXISTS public.display_settings (
    id TEXT PRIMARY KEY DEFAULT 'current_display_config',
    mode TEXT NOT NULL DEFAULT 'all', -- 'all', 'group', 'stage'
    target_id UUID,
    slideshow_active BOOLEAN NOT NULL DEFAULT false,
    slideshow_interval_seconds INT NOT NULL DEFAULT 15,
    custom_title TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.display_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view display settings" ON public.display_settings;
CREATE POLICY "Anyone can view display settings"
    ON public.display_settings FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can insert display settings" ON public.display_settings;
CREATE POLICY "Admins can insert display settings"
    ON public.display_settings FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Admins can update display settings" ON public.display_settings;
CREATE POLICY "Admins can update display settings"
    ON public.display_settings FOR UPDATE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- صف البث الافتراضي الأولي
INSERT INTO public.display_settings (id, mode, slideshow_active, slideshow_interval_seconds)
VALUES ('current_display_config', 'all', false, 15)
ON CONFLICT (id) DO NOTHING;

-- تفعيل البث الحي Realtime لجدول إعدادات الشاشة
ALTER TABLE public.display_settings REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.display_settings; EXCEPTION WHEN duplicate_object THEN null; END $$;

