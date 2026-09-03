import React, { useState } from 'react';
import { Child, PointRule } from '../../types/database';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { X, Plus, Minus, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { sounds, triggerConfetti } from '../../lib/effects';

interface QuickPointsModalProps {
  child: Child;
  rules: PointRule[];
  pointsToday: number;
  pointsTotal: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const QuickPointsModal: React.FC<QuickPointsModalProps> = ({
  child,
  rules,
  pointsToday,
  pointsTotal,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [filterType, setFilterType] = useState<'all' | 'add' | 'deduct'>('all');
  const [customReason, setCustomReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredRules = rules.filter((r) => {
    if (!r.is_active) return false;
    if (filterType === 'all') return true;
    return r.type === filterType;
  });

  const handleApplyRule = async (rule: PointRule) => {
    if (!user) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const reason = customReason.trim() ? `${rule.title} - ${customReason.trim()}` : rule.title;
      const signedPoints = rule.type === 'deduct' ? -Math.abs(rule.points) : Math.abs(rule.points);

      const { error } = await supabase.from('point_logs').insert({
        child_id: child.id,
        family_id: child.family_id,
        stage_id: child.stage_id,
        rule_id: rule.id,
        points: signedPoints,
        reason: reason,
        servant_id: user.id,
      });

      if (error) throw error;

      if (rule.points > 0) {
        sounds.playSuccess();
        triggerConfetti();
      } else {
        sounds.playDeduct();
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error adding point log:', err);
      setErrorMsg(err instanceof Error ? err.message : 'فشلت عملية تسجيل النقاط. تأكد من الصلاحيات.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-church-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-church-700 via-church-600 to-church-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-yellow-300 bg-church-900 flex items-center justify-center text-xl font-bold shadow-md">
              {child.image_url ? (
                <img src={child.image_url} alt={child.full_name} className="w-full h-full object-cover" />
              ) : (
                child.full_name.charAt(0)
              )}
            </div>
            <div>
              <h3 className="text-lg font-black text-white">{child.full_name}</h3>
              <p className="text-xs text-church-200 font-semibold">
                {child.family?.name} • {child.stage?.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-church-200 hover:text-white hover:bg-church-500/40 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Current Points Bar */}
        <div className="bg-church-50 border-b border-church-200 px-6 py-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-semibold">نقاط اليوم:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-black text-sm border border-amber-300">
              {pointsToday} نقطة
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-semibold">الإجمالي العام:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 font-black text-sm border border-blue-300">
              {pointsTotal} نقطة
            </span>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="p-4 border-b border-church-100 flex items-center gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === 'all'
                ? 'bg-church-600 text-white shadow'
                : 'bg-church-100 text-church-900 hover:bg-church-200'
            }`}
          >
            الكل ({rules.filter((r) => r.is_active).length})
          </button>
          <button
            onClick={() => setFilterType('add')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              filterType === 'add'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <Plus size={14} />
            إضافة فقط
          </button>
          <button
            onClick={() => setFilterType('deduct')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              filterType === 'deduct'
                ? 'bg-rose-600 text-white shadow'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            <Minus size={14} />
            خصم فقط
          </button>
        </div>

        {/* Error notification if any */}
        {errorMsg && (
          <div className="mx-4 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Rules Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredRules.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              لا توجد بنود مطابقة لنوع التصفية
            </div>
          ) : (
            filteredRules.map((rule) => {
              const isAdd = rule.type === 'add';
              return (
                <button
                  key={rule.id}
                  disabled={submitting}
                  onClick={() => handleApplyRule(rule)}
                  className={`w-full p-3.5 rounded-2xl border-2 text-right flex items-center justify-between transition-all group active:scale-[0.99] ${
                    isAdd
                      ? 'bg-emerald-50/40 hover:bg-emerald-100/70 border-emerald-200/80 hover:border-emerald-400'
                      : 'bg-rose-50/40 hover:bg-rose-100/70 border-rose-200/80 hover:border-rose-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shadow-sm ${
                        isAdd ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                      }`}
                    >
                      {isAdd ? `+${rule.points}` : rule.points}
                    </div>
                    <div>
                      <div className="font-extrabold text-sm text-slate-800 group-hover:text-church-900">
                        {rule.title}
                      </div>
                      {rule.description && (
                        <div className="text-[11px] text-slate-500">{rule.description}</div>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-xl shadow-xs transition-transform group-hover:scale-105 ${
                      isAdd ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    تسجيل بنقرة واحدة
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Optional Note / Reason Footer */}
        <div className="p-4 bg-church-50/70 border-t border-church-200">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            ملاحظة إضافية على الحركة (اختياري):
          </label>
          <input
            type="text"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="مثال: تسميع مزمور 23 كاملاً، أو إجابة مسابقة..."
            className="w-full text-xs px-3 py-2 rounded-xl border border-church-300 focus:outline-none focus:ring-2 focus:ring-church-500 bg-white"
          />
        </div>
      </div>
    </div>
  );
};
