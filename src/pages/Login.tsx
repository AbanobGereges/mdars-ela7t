import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, LogIn, UserPlus, AlertCircle, CheckCircle, Tv } from 'lucide-react';

export const Login: React.FC<{ onOpenDisplayDirectly: () => void }> = ({ onOpenDisplayDirectly }) => {
  const { signIn, signUp, isConfigured } = useAuth();
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [familyId, setFamilyId] = useState<string>('');
  const [availableFamilies, setAvailableFamilies] = useState<Array<{ id: string; name: string; stage?: { name: string } }>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (isConfigured) {
      import('../lib/supabase').then(({ supabase }) => {
        supabase
          .from('families')
          .select('id, name, stage:stages(name)')
          .eq('is_active', true)
          .order('name')
          .then(({ data }) => {
            if (data) {
              setAvailableFamilies(
                data as unknown as Array<{ id: string; name: string; stage?: { name: string } }>
              );
            }
          });
      });
    }
  }, [isConfigured]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (!fullName.trim()) {
          setErrorMsg('يرجى كتابة الاسم بالكامل');
          setLoading(false);
          return;
        }

        const { error } = await signUp(email.trim(), password, fullName.trim(), familyId || undefined);
        if (error) throw error;

        setSuccessMsg(
          'تم إنشاء الحساب بنجاح وتحديد الأسرة! إذا كان هذا أول حساب مسجل بالنظام فسيكون أدمن تلقائياً، وإلا سينتظر اعتماد مسؤول الخدمة.'
        );
      } else {
        const { error } = await signIn(email.trim(), password);
        if (error) throw error;
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'فشل تسجيل الدخول، تحقق من البيانات');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbf7ee] flex flex-col justify-center items-center px-4 py-12">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-3xl bg-church-100 border-2 border-church-300 flex items-center justify-center text-4xl shadow-md mx-auto mb-3 animate-float">
          ⛪
        </div>
        <h1 className="text-3xl font-black text-church-950 tracking-wide">
          خدمة مدارس الأحد
        </h1>
        <p className="text-xs sm:text-sm text-church-700 font-bold mt-1">
          منظومة إدارة الخدمة، النقاط التفاعلية، وشاشات التتويج
        </p>
      </div>

      {/* Auth Card */}
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-church-200 overflow-hidden">
        {/* Supabase Config Warning */}
        {!isConfigured && (
          <div className="bg-amber-50 border-b border-amber-200 p-4 text-xs text-amber-900 flex items-start gap-2">
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">تنبيه إعداد Supabase:</p>
              <p className="mt-1 leading-relaxed">
                يرجى فتح ملف <code className="bg-amber-100 px-1 rounded font-mono">.env</code> ووضع رابط مشروع Supabase والمفتاح العام <code className="bg-amber-100 px-1 rounded font-mono">VITE_SUPABASE_ANON_KEY</code>، ثم تنفيذ ملف <code className="bg-amber-100 px-1 rounded font-mono">supabase/schema.sql</code> في الـ SQL Editor لتهيئة الجداول.
              </p>
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-church-100 text-xs font-bold">
          <button
            onClick={() => {
              setIsRegister(false);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-3.5 text-center transition-colors flex items-center justify-center gap-1.5 ${
              !isRegister
                ? 'text-church-900 border-b-2 border-church-600 bg-church-50/50'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <LogIn size={15} />
            تسجيل الدخول
          </button>
          <button
            onClick={() => {
              setIsRegister(true);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-3.5 text-center transition-colors flex items-center justify-center gap-1.5 ${
              isRegister
                ? 'text-church-900 border-b-2 border-church-600 bg-church-50/50'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <UserPlus size={15} />
            تسجيل خادم جديد
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {isRegister && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم بالكامل:</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: الخادم مينا نبيل"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-church-300 focus:outline-none focus:ring-2 focus:ring-church-500 bg-church-50/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الأسرة التي تخدم بها:</label>
                <select
                  value={familyId}
                  onChange={(e) => setFamilyId(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-church-300 focus:outline-none focus:ring-2 focus:ring-church-500 bg-white"
                >
                  <option value="">اختر أسرتك...</option>
                  {availableFamilies.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.stage?.name || 'عام'})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  اختر أسرتك لربط حسابك بها فور اعتمادك من مسؤول الخدمة
                </span>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني:</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@church.com"
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-church-300 focus:outline-none focus:ring-2 focus:ring-church-500 bg-church-50/30 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور:</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-church-300 focus:outline-none focus:ring-2 focus:ring-church-500 bg-church-50/30 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-church-600 to-church-700 hover:from-church-700 hover:to-church-800 text-white font-black text-xs shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : isRegister ? (
              <>
                <UserPlus size={16} />
                <span>إنشاء حساب</span>
              </>
            ) : (
              <>
                <LogIn size={16} />
                <span>دخول للنظام</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Display Mode Link */}
        <div className="p-4 bg-church-50/60 border-t border-church-100 text-center">
          <button
            type="button"
            onClick={onOpenDisplayDirectly}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-church-800 hover:text-church-950 transition-colors"
          >
            <Tv size={14} className="text-church-600" />
            <span>فتح شاشة العرض (Display Mode) للشاشات والتلفزيون مباشرة</span>
          </button>
        </div>
      </div>
    </div>
  );
};
