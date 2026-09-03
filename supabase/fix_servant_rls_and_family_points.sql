-- ==============================================================================
-- ⛪ حل شامل وفوري لظهور الأسر والأولاد والنقاط لحسابات الخدام
-- ==============================================================================

-- 1. التأكد من فتح صلاحيات القراءة (SELECT) لجميع الجداول بدون استثناء
--    (لكي يرى الخادم والأدمن وشاشة العرض بيانات الأولاد والنقاط والأسر فوراً)
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
CREATE POLICY "Profiles select policy" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Stages select policy" ON public.stages;
CREATE POLICY "Stages select policy" ON public.stages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Families select policy" ON public.families;
CREATE POLICY "Families select policy" ON public.families FOR SELECT USING (true);

DROP POLICY IF EXISTS "Children select policy" ON public.children;
CREATE POLICY "Children select policy" ON public.children FOR SELECT USING (true);

DROP POLICY IF EXISTS "Point rules select policy" ON public.point_rules;
CREATE POLICY "Point rules select policy" ON public.point_rules FOR SELECT USING (true);

DROP POLICY IF EXISTS "Family servants select policy" ON public.family_servants;
CREATE POLICY "Family servants select policy" ON public.family_servants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Point logs select policy" ON public.point_logs;
CREATE POLICY "Point logs select policy" ON public.point_logs FOR SELECT USING (true);


-- 2. تحديث صلاحية تسجيل النقاط (INSERT)
--    السماح للخادم بإضافة نقاط للأولاد أو مباشرة للأسرة (بدون اشتراط child_id)
DROP POLICY IF EXISTS "Point logs insert policy" ON public.point_logs;
CREATE POLICY "Point logs insert policy" ON public.point_logs
    FOR INSERT
    WITH CHECK (
        public.is_admin() OR (
            public.is_approved_user() 
            AND servant_id = auth.uid()
            AND public.servant_has_family(family_id)
        )
    );


-- 3. التأكد من صلاحية الأدمن في إدارة أسر الخدام
DROP POLICY IF EXISTS "Family servants admin manage policy" ON public.family_servants;
CREATE POLICY "Family servants admin manage policy" ON public.family_servants
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- 4. إسناد أسر تلقائياً لأي خادم مسجل ليس لديه أسر معينة حالياً
--    (هذا يحل المشكلة فوراً لأي خادم لا تظهر له أسر، بحيث ترتبط به أسر الخدمة وتظهر له مع أولادها ونقاطها)
INSERT INTO public.family_servants (family_id, servant_id)
SELECT f.id, p.id
FROM public.profiles p
CROSS JOIN public.families f
WHERE p.role = 'servant'
  AND NOT EXISTS (
      SELECT 1 FROM public.family_servants fs WHERE fs.servant_id = p.id
  )
ON CONFLICT DO NOTHING;

-- 5. التأكد من أن جميع الأولاد والأسر حالتهم نشطة (is_active = true)
UPDATE public.children SET is_active = true WHERE is_active IS NULL;
UPDATE public.families SET is_active = true WHERE is_active IS NULL;
UPDATE public.stages SET is_active = true WHERE is_active IS NULL;
