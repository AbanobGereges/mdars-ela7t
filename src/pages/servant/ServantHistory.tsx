import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtimePoints } from '../../hooks/useRealtimePoints';
import { History, ArrowUpRight, ArrowDownRight, Clock, Award } from 'lucide-react';

export const ServantHistory: React.FC = () => {
  const { user, assignedFamilies, role } = useAuth();
  const { recentLogs, loading } = useRealtimePoints();

  // Filter logs to only those done by this servant or for their assigned families
  const myLogs = recentLogs.filter((log) => {
    if (role === 'admin') return true;
    return log.servant_id === user?.id || assignedFamilies.includes(log.family_id);
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-church-950 flex items-center gap-2">
            <History className="text-church-600" />
            سجل حركات النقاط
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            استعراض كافة عمليات إضافة وخصم النقاط المسجلة لأولاد أسر الخدمة
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-10 h-10 border-4 border-church-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs font-bold text-slate-600">جاري تحميل السجل...</p>
        </div>
      ) : myLogs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-church-200 shadow-sm">
          <Award size={48} className="text-church-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">لا توجد عمليات نقاط مسجلة بعد</h3>
          <p className="text-xs text-slate-500 mt-1">ابدأ بتسجيل النقاط لأولاد أسر الخدمة وستظهر كل حركة هنا بالتفصيل</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-church-200 overflow-hidden shadow-sm divide-y divide-church-100">
          {myLogs.map((log) => {
            const isAdd = log.points > 0;
            const dateObj = new Date(log.created_at);
            const timeStr = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            const dateStr = dateObj.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });

            return (
              <div key={log.id} className="p-4 flex items-center justify-between hover:bg-church-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm ${
                      isAdd ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {isAdd ? `+${log.points}` : log.points}
                  </div>
                  <div>
                    <div className="font-extrabold text-sm text-slate-900">
                      {log.child?.full_name || 'مخدوم'}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{log.family?.name}</span>
                      <span>•</span>
                      <span className="text-church-700 font-semibold">{log.reason}</span>
                    </div>
                  </div>
                </div>

                <div className="text-left flex flex-col items-end">
                  <span className="text-xs font-bold text-slate-700">{timeStr}</span>
                  <span className="text-[10px] text-slate-400">{dateStr}</span>
                  {log.is_reverted && (
                    <span className="mt-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                      تم التراجع
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
