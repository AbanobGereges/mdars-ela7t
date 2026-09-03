import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { PointLog, Stage, Family, Profile } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import {
  History,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  Calendar,
  Users,
  Home,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export const AuditLogs: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<PointLog[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [servants, setServants] = useState<Profile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [familyFilter, setFamilyFilter] = useState<string>('all');
  const [servantFilter, setServantFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all'); // all, add, deduct
  const [dateFilter, setDateFilter] = useState<string>(''); // YYYY-MM-DD

  // Revert action modal
  const [revertingLog, setRevertingLog] = useState<PointLog | null>(null);
  const [revertReason, setRevertReason] = useState<string>('');
  const [submittingRevert, setSubmittingRevert] = useState<boolean>(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const [logsRes, stgsRes, famsRes, servRes, kidsRes, rulesRes] = await Promise.all([
        supabase.from('point_logs').select('*').order('created_at', { ascending: false }),
        supabase.from('stages').select('*').order('sort_order'),
        supabase.from('families').select('*').order('name'),
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('children').select('*'),
        supabase.from('point_rules').select('*'),
      ]);

      const stagesData = (stgsRes.data as Stage[]) || [];
      const famsData = (famsRes.data as Family[]) || [];
      const servData = (servRes.data as Profile[]) || [];
      const kidsData = (kidsRes.data as Child[]) || [];
      const rulesData = (rulesRes.data as PointRule[]) || [];

      setStages(stagesData);
      setFamilies(famsData);
      setServants(servData);

      if (logsRes.data) {
        const enrichedLogs: PointLog[] = (logsRes.data as PointLog[]).map((l) => ({
          ...l,
          child: kidsData.find((c) => c.id === l.child_id) || null,
          family: famsData.find((f) => f.id === l.family_id) || null,
          stage: stagesData.find((s) => s.id === l.stage_id) || null,
          servant: servData.find((p) => p.id === l.servant_id) || null,
          rule: rulesData.find((r) => r.id === l.rule_id) || null,
        }));
        setLogs(enrichedLogs);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleRevertTransaction = async () => {
    if (!revertingLog || !user) return;
    setSubmittingRevert(true);

    try {
      // Mark log as reverted without deleting history!
      const { error: updateErr } = await supabase
        .from('point_logs')
        .update({
          is_reverted: true,
          reverted_at: new Date().toISOString(),
          revert_reason: revertReason.trim() || 'إلغاء وتصحيح الحركة بواسطة الأدمن',
          reverted_by: user.id,
        })
        .eq('id', revertingLog.id);

      if (updateErr) throw updateErr;

      // Insert counter transaction to keep balanced ledger
      const counterPoints = -revertingLog.points;
      const { error: insertErr } = await supabase.from('point_logs').insert({
        child_id: revertingLog.child_id,
        family_id: revertingLog.family_id,
        stage_id: revertingLog.stage_id,
        points: counterPoints,
        reason: `حركة تصحيحية: تراجع عن (${revertingLog.reason})`,
        servant_id: user.id,
      });

      if (insertErr) throw insertErr;

      await fetchLogs();
      setRevertingLog(null);
      setRevertReason('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل التراجع عن العملية');
    } finally {
      setSubmittingRevert(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (stageFilter !== 'all' && log.stage_id !== stageFilter) return false;
    if (familyFilter !== 'all' && log.family_id !== familyFilter) return false;
    if (servantFilter !== 'all' && log.servant_id !== servantFilter) return false;

    if (typeFilter === 'add' && log.points <= 0) return false;
    if (typeFilter === 'deduct' && log.points >= 0) return false;

    if (dateFilter) {
      const logDate = new Date(log.created_at).toISOString().split('T')[0];
      if (logDate !== dateFilter) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchChild = log.child?.full_name.toLowerCase().includes(q);
      const matchServant = log.servant?.full_name.toLowerCase().includes(q);
      const matchReason = log.reason.toLowerCase().includes(q);
      return matchChild || matchServant || matchReason;
    }

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-church-950 flex items-center gap-2">
            <History className="text-church-600" />
            سجل العمليات والتدقيق (Audit Logs)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            سجل دائم وغير قابل للتلاعب لكل عمليات إضافة وخصم النقاط مع إمكانية التراجع والتصفية الدقيقة
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-3xl p-5 border border-church-200 shadow-sm mb-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالطفل، الخادم، أو السبب..."
              className="w-full text-xs pr-8 pl-3 py-2 rounded-xl border border-church-300 focus:outline-none focus:ring-2 focus:ring-church-500 bg-church-50/50"
            />
            <Search size={14} className="absolute right-2.5 top-2.5 text-slate-400" />
          </div>

          {/* Stage */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-church-300 bg-church-50 text-slate-800 font-bold focus:outline-none"
          >
            <option value="all">كل المراحل</option>
            {stages.map((stg) => (
              <option key={stg.id} value={stg.id}>
                {stg.name}
              </option>
            ))}
          </select>

          {/* Family */}
          <select
            value={familyFilter}
            onChange={(e) => setFamilyFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-church-300 bg-church-50 text-slate-800 font-bold focus:outline-none"
          >
            <option value="all">كل الأسر</option>
            {families.map((fam) => (
              <option key={fam.id} value={fam.id}>
                {fam.name}
              </option>
            ))}
          </select>

          {/* Servant */}
          <select
            value={servantFilter}
            onChange={(e) => setServantFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-church-300 bg-church-50 text-slate-800 font-bold focus:outline-none"
          >
            <option value="all">كل الخدام</option>
            {servants.map((srv) => (
              <option key={srv.id} value={srv.id}>
                {srv.full_name}
              </option>
            ))}
          </select>

          {/* Type */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-church-300 bg-church-50 text-slate-800 font-bold focus:outline-none"
          >
            <option value="all">كل العمليات (إضافة وخصم)</option>
            <option value="add">إضافة فقط (+)</option>
            <option value="deduct">خصم فقط (-)</option>
          </select>
        </div>

        {/* Date filter & Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-church-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold">تصفية بالتاريخ:</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-church-300 text-xs font-semibold focus:outline-none"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="text-church-600 hover:text-church-800 font-bold text-xs"
              >
                مسح التاريخ
              </button>
            )}
          </div>

          <div className="text-slate-500 font-semibold">
            عرض {filteredLogs.length} عملية
          </div>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="text-center py-16">
          <div className="w-10 h-10 border-4 border-church-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs font-bold text-slate-600">جاري تحميل سجل العمليات...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-church-200">
          <History size={48} className="text-church-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">لا توجد عمليات مسجلة مطابقة للبحث</h3>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-church-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-church-50/80 border-b border-church-200 text-church-950 font-black">
                  <th className="py-4 px-4">التاريخ والوقت</th>
                  <th className="py-4 px-4">المخدوم</th>
                  <th className="py-4 px-4">الأسرة والمرحلة</th>
                  <th className="py-4 px-4">النقاط</th>
                  <th className="py-4 px-4">سبب العملية</th>
                  <th className="py-4 px-4">الخادم المنفذ</th>
                  <th className="py-4 px-4 text-center">الحالة / إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-church-100 font-medium">
                {filteredLogs.map((log) => {
                  const isAdd = log.points > 0;
                  const dateObj = new Date(log.created_at);
                  const timeStr = dateObj.toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const dateStr = dateObj.toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-church-50/40 transition-colors ${
                        log.is_reverted ? 'bg-amber-50/40 opacity-75' : ''
                      }`}
                    >
                      {/* Timestamp */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{timeStr}</div>
                        <div className="text-[10px] text-slate-400">{dateStr}</div>
                      </td>

                      {/* Child */}
                      <td className="py-4 px-4">
                        <div className="font-extrabold text-slate-900">
                          {log.child?.full_name || '—'}
                        </div>
                      </td>

                      {/* Family & Stage */}
                      <td className="py-4 px-4">
                        <div className="text-slate-700">{log.family?.name}</div>
                        <div className="text-[10px] text-slate-400">{log.stage?.name}</div>
                      </td>

                      {/* Points */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full font-black text-xs ${
                            isAdd
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {isAdd ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                          {isAdd ? `+${log.points}` : log.points}
                        </span>
                      </td>

                      {/* Reason */}
                      <td className="py-4 px-4">
                        <span className="font-bold text-slate-800">{log.reason}</span>
                        {log.is_reverted && log.revert_reason && (
                          <div className="text-[10px] text-amber-800 font-semibold mt-0.5">
                            سبب التراجع: {log.revert_reason}
                          </div>
                        )}
                      </td>

                      {/* Servant */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-church-900">
                          🙋 {log.servant?.full_name || log.servant?.email || '—'}
                        </div>
                      </td>

                      {/* Revert status / Action */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        {log.is_reverted ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-300">
                            تم التراجع
                          </span>
                        ) : (
                          <button
                            onClick={() => setRevertingLog(log)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 font-bold text-xs transition-colors border border-slate-200"
                            title="التراجع عن هذه العملية"
                          >
                            <RotateCcw size={12} />
                            <span>تراجع</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revert Modal */}
      {revertingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-church-200 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-5 flex items-center justify-between">
              <h3 className="text-base font-black flex items-center gap-2">
                <RotateCcw size={18} />
                تأكيد التراجع عن عملية النقاط
              </h3>
              <button onClick={() => setRevertingLog(null)} className="text-amber-100 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-right">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs space-y-1.5 text-amber-950">
                <div>
                  <strong>الطفل:</strong> {revertingLog.child?.full_name}
                </div>
                <div>
                  <strong>النقاط:</strong> {revertingLog.points > 0 ? `+${revertingLog.points}` : revertingLog.points}
                </div>
                <div>
                  <strong>السبب:</strong> {revertingLog.reason}
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                سيتم تأشير هذه العملية كـ "تم التراجع عنها" وإدراج حركة عكسية تلقائياً في السجل للحفاظ على دقة التدقيق المالي والكنسي.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  سبب التراجع (اختياري):
                </label>
                <input
                  type="text"
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
                  placeholder="مثال: تسجيل بالخطأ، أو تعديل قرار..."
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-church-300 focus:outline-none focus:ring-2 focus:ring-church-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRevertingLog(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  disabled={submittingRevert}
                  onClick={handleRevertTransaction}
                  className="px-6 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-md transition-all active:scale-95"
                >
                  {submittingRevert ? 'جاري التنفيذ...' : 'تأكيد التراجع'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
