import React, { useEffect, useState } from 'react';
import { useRealtimePoints } from '../../hooks/useRealtimePoints';
import { supabase } from '../../lib/supabase';
import {
  Users,
  Home,
  UserCheck,
  Award,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Layers,
  CheckCircle2,
  PlusCircle,
} from 'lucide-react';
import { FamilyPointsModal } from '../../components/common/FamilyPointsModal';

interface StatsCounters {
  totalChildren: number;
  totalFamilies: number;
  totalServants: number;
  totalStages: number;
}

export const AdminDashboard: React.FC<{ onNavigateTab: (tab: string) => void }> = ({ onNavigateTab }) => {
  const { top3ChildrenToday, top3FamiliesToday, allFamiliesToday, recentLogs, totalPointsToday, loading, refreshData } = useRealtimePoints();
  const [familyPointsModalOpen, setFamilyPointsModalOpen] = useState<boolean>(false);
  const [targetFamilyForPoints, setTargetFamilyForPoints] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsCounters>({
    totalChildren: 0,
    totalFamilies: 0,
    totalServants: 0,
    totalStages: 0,
  });

  useEffect(() => {
    const fetchCounters = async () => {
      const [chRes, famRes, servRes, stgRes] = await Promise.all([
        supabase.from('children').select('id', { count: 'exact', head: true }),
        supabase.from('families').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'servant'),
        supabase.from('stages').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        totalChildren: chRes.count || 0,
        totalFamilies: famRes.count || 0,
        totalServants: servRes.count || 0,
        totalStages: stgRes.count || 0,
      });
    };

    fetchCounters();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-church-900 via-church-800 to-church-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-church-700/50">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 px-3 py-1 rounded-full text-xs font-bold mb-3">
            <Sparkles size={14} />
            لوحة الإدارة الشاملة (Admin)
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">إدارة خدمة مدارس الأحد</h1>
          <p className="text-sm text-church-200 mt-1 max-w-xl">
            متابعة حية للخدام والمخدومين، إحصائيات النقاط، وترتيب الأبطال على مدار اليوم اللحظي.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setTargetFamilyForPoints(null);
              setFamilyPointsModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-yellow-950 font-black text-xs shadow-lg transition-all active:scale-95 flex items-center gap-1.5"
          >
            <PlusCircle size={16} />
            <span>إضافة نقاط للأسرة</span>
          </button>
          <button
            onClick={() => onNavigateTab('display')}
            className="px-4 py-2.5 rounded-2xl bg-church-700 hover:bg-church-600 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5 border border-church-500/30"
          >
            <Award size={16} />
            <span>شاشة العرض (TV Mode)</span>
          </button>
          <button
            onClick={() => onNavigateTab('rules')}
            className="px-4 py-2.5 rounded-2xl bg-church-700/80 hover:bg-church-600 border border-church-500/40 text-white font-bold text-xs shadow transition-all"
          >
            إعدادات النقاط
          </button>
        </div>
      </div>

      {/* 4 Main Statistics Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div
          onClick={() => onNavigateTab('children')}
          className="bg-white p-5 rounded-3xl border border-church-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">إجمالي الأولاد</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
              <Users size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-800">{stats.totalChildren}</div>
          <span className="text-[11px] text-amber-700 font-semibold mt-1 block">عرض وإدارة المخدومين ←</span>
        </div>

        <div
          onClick={() => onNavigateTab('families')}
          className="bg-white p-5 rounded-3xl border border-church-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">عدد الأسر</span>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <Home size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-800">{stats.totalFamilies}</div>
          <span className="text-[11px] text-blue-700 font-semibold mt-1 block">عرض وإدارة الأسر ←</span>
        </div>

        <div
          onClick={() => onNavigateTab('users')}
          className="bg-white p-5 rounded-3xl border border-church-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">عدد الخدام</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <UserCheck size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-800">{stats.totalServants}</div>
          <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">اعتماد وصلاحيات الخدام ←</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-church-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">نقاط اليوم الكلية</span>
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <Award size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-purple-700">
            {totalPointsToday}
            <span className="text-sm font-bold text-slate-400 mr-1">نقطة</span>
          </div>
          <span className="text-[11px] text-purple-600 font-semibold mt-1 block">تحديث لحظي عبر Realtime</span>
        </div>
      </div>

      {/* Two columns: Top 3 Preview & Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Leaders Overview */}
        <div className="space-y-6">
          {/* Top 3 Children Card */}
          <div className="bg-white rounded-3xl p-6 border border-church-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-church-950 flex items-center gap-2">
                <span>🏆</span>
                أبطال اليوم (أعلى 3 أولاد)
              </h3>
              <button
                onClick={() => onNavigateTab('display')}
                className="text-xs font-bold text-church-600 hover:text-church-800"
              >
                شاشة العرض كاملة ←
              </button>
            </div>

            {top3ChildrenToday.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">لا توجد نقاط مسجلة اليوم بعد</p>
            ) : (
              <div className="space-y-3">
                {top3ChildrenToday.map((entry, idx) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div
                      key={entry.child.id}
                      className="p-3.5 rounded-2xl bg-church-50/60 border border-church-200/60 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{medals[idx]}</span>
                        <div>
                          <div className="font-extrabold text-sm text-slate-900">
                            {entry.child.full_name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {entry.child.family?.name} • {entry.child.stage?.name}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-black text-amber-600">{entry.pointsToday}</span>
                        <span className="text-xs text-slate-500 mr-1">نقطة اليوم</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top 3 Families Card */}
          <div className="bg-white rounded-3xl p-6 border border-church-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-church-950 flex items-center gap-2">
                <span>🏠</span>
                أبطال الأسر (أعلى 3 أسر اليوم)
              </h3>
            </div>

            {top3FamiliesToday.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">لا توجد نقاط مسجلة اليوم بعد</p>
            ) : (
              <div className="space-y-3">
                {top3FamiliesToday.map((entry, idx) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  const kidsPts = entry.childrenPointsToday || 0;
                  const directPts = entry.directPointsToday || 0;
                  const totalPts = entry.pointsToday;

                  return (
                    <div
                      key={entry.family.id}
                      className="p-3.5 rounded-2xl bg-church-50/60 border border-church-200/60 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{medals[idx]}</span>
                        <div>
                          <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                            <span>{entry.family.name}</span>
                            <span className="text-[10px] bg-white border border-church-200 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                              {entry.family.stage?.name}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            أولاد: <strong className="text-slate-800">{kidsPts}</strong> • 
                            مباشرة: <strong className="text-amber-800">{directPts > 0 ? `+${directPts}` : directPts}</strong>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-lg font-black text-emerald-700">{totalPts}</span>
                          <span className="text-xs text-slate-500 mr-1">نقطة اليوم</span>
                        </div>
                        <button
                          onClick={() => {
                            setTargetFamilyForPoints(entry.family.id);
                            setFamilyPointsModalOpen(true);
                          }}
                          className="p-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 transition-colors"
                          title="إضافة نقاط مباشرة لهذه الأسرة"
                        >
                          <PlusCircle size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Latest Point Operations */}
        <div className="bg-white rounded-3xl p-6 border border-church-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-church-950 flex items-center gap-2">
                <Clock className="text-church-600" size={20} />
                أحدث عمليات النقاط
              </h3>
              <button
                onClick={() => onNavigateTab('audit')}
                className="text-xs font-bold text-church-600 hover:text-church-800"
              >
                السجل والتدقيق الكامل ←
              </button>
            </div>

            {recentLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-12 text-center">لا توجد عمليات مسجلة في السجل</p>
            ) : (
              <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                {recentLogs.slice(0, 8).map((log) => {
                  const isAdd = log.points > 0;
                  const timeStr = new Date(log.created_at).toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={log.id}
                      className="p-3 rounded-2xl bg-church-50/50 border border-church-100 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-9 h-9 rounded-xl font-black flex items-center justify-center shrink-0 ${
                            isAdd ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isAdd ? `+${log.points}` : log.points}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900">
                            {log.child?.full_name || 'مخدوم'}
                            <span className="text-slate-400 font-normal mr-1">
                              (بواسطة: {log.servant?.full_name || 'خادم'})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {log.family?.name} • {log.reason}
                          </div>
                        </div>
                      </div>
                      <span className="text-slate-400 font-medium shrink-0">{timeStr}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <FamilyPointsModal
        isOpen={familyPointsModalOpen}
        onClose={() => setFamilyPointsModalOpen(false)}
        onSuccess={() => {
          refreshData();
        }}
        families={allFamiliesToday.map((f) => f.family)}
        preSelectedFamilyId={targetFamilyForPoints}
      />
    </div>
  );
};
