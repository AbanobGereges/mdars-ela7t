-- ==============================================================================
-- ⛪ تثبيت نظام اعتماد الحسابات وتأكيد الإيميل التلقائي في Supabase Auth
-- نفّذ هذا الكود داخل: Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. تحديث كافة الحسابات المعتمدة حالياً لتأكيد بريدها فوراً في auth.users
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE id IN (SELECT id FROM public.profiles WHERE is_approved = true)
  AND email_confirmed_at IS NULL;

-- 2. دالة وتريجر لتأكيد البريد تلقائياً لأي مستخدم جديد يسجل حسابه
-- وبذلك لن تطلب Supabase الضغط على رابط الإيميل كشرط لتسجيل الدخول
CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_before_insert ON auth.users;
CREATE TRIGGER on_auth_user_before_insert
    BEFORE INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_new_user();

-- 3. تحديث دالة approve_user لضمان تأكيد البريد واعتماد البروفايل عند موافقة الأدمن
CREATE OR REPLACE FUNCTION public.approve_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- التحقق من صلاحيات الأدمن
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'فقط مسؤولو الخدمة (Admins) يملكون صلاحية اعتماد الخدام';
    END IF;

    -- 1. تفعيل الاعتماد في جدول profiles
    UPDATE public.profiles
    SET is_approved = true, updated_at = now()
    WHERE id = target_user_id;

    -- 2. تأكيد البريد في auth.users لتمكين المستخدم من تسجيل الدخول فوراً
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE id = target_user_id;
END;
$$;
