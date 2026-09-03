import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Clock, RefreshCw, LogOut } from 'lucide-react';

export const UnapprovedNotice: React.FC = () => {
  const { profile, user, refreshProfile, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-[#fbf7ee] flex flex-col justify-center items-center px-4 py-12">
      <div className="bg-white max-w-md w-full rounded-3xl p-8 border border-church-200 shadow-xl text-center space-y-5">
        <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto border border-amber-300">
          <Clock size={32} className="animate-pulse" />
        </div>

        <div>
          <h2 className="text-2xl font-black text-church-950">حسابك في انتظار الاعتماد</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            أهلاً بك يا خادم المسيح ({profile?.full_name || user?.email}). تم تسجيل حسابك بنجاح، وبانتظار تفعيله وتحديد الأسر المخصصة لك من قبل مدير الخدمة (الأدمن).
          </p>
        </div>

        <div className="p-4 bg-church-50 rounded-2xl border border-church-200 text-xs text-church-900 font-medium">
          بمجرد قيام الأدمن باعتماد حسابك وتحديد الأسر، ستفتح لك واجهة تسجيل النقاط فوراً.
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full py-2.5 rounded-xl bg-church-600 hover:bg-church-700 text-white text-xs font-bold transition-all shadow flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'جاري التحقق...' : 'تحديث حالة الاعتماد الآن'}</span>
          </button>

          <button
            onClick={() => signOut()}
            className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
          >
            <LogOut size={14} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>
    </div>
  );
};
