import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Family } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import { sounds, triggerConfetti } from '../../lib/effects';
import { Home, PlusCircle, MinusCircle, AlertCircle, Sparkles, X } from 'lucide-react';

interface FamilyPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  families: Family[];
  preSelectedFamilyId?: string | null;
}

const COMMON_REASONS = [
  'نشاط وتفاعل جماعي للأسرة',
  'حضور كامل ونسبة تفاعل عالية',
  'الفوز في مسابقة الأسر الأسبوعية',
  'تنظيم وهدوء وسلوك متميز',
  'مشاركة في قداس الأحد والأنشطة',
  'حفظ التسميع الجماعي للأسرة',
];

export const FamilyPointsModal: React.FC<FamilyPointsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  families,
  preSelectedFamilyId,
}) => {
  const { user } = useAuth();
  const [selectedFamId, setSelectedFamId] = useState<string>('');
  const [points, setPoints] = useState<number>(5);
  const [type, setType] = useState<'add' | 'deduct'>('add');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (preSelectedFamilyId && families.some((f) => f.id === preSelectedFamilyId)) {
        setSelectedFamId(preSelectedFamilyId);
      } else if (families.length > 0) {
        setSelectedFamId(families[0].id);
      }
      setPoints(5);
      setType('add');
      setReason('');
      setErrorMessage(null);
    }
  }, [isOpen, preSelectedFamilyId, families]);

  if (!isOpen) return null;

  const currentFamily = families.find((f) => f.id === selectedFamId) || families[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMessage('يجب تسجيل الدخول أولاً');
      return;
    }
    if (!selectedFamId || !currentFamily) {
      setErrorMessage('يرجى اختيار الأسرة');
      return;
    }
    if (!points || points <= 0) {
      setErrorMessage('يرجى إدخال عدد نقاط أكبر من 0');
      return;
    }
    if (!reason.trim()) {
      setErrorMessage('يرجى كتابة سبب العملية');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const signedPoints = type === 'add' ? Math.abs(points) : -Math.abs(points);

    try {
      const { error: insertError } = await supabase.from('point_logs').insert({
        family_id: selectedFamId,
        stage_id: currentFamily.stage_id,
        child_id: null, // Direct family point
        points: signedPoints,
        reason: reason.trim(),
        servant_id: user.id,
      });

      if (insertError) throw insertError;

      if (signedPoints > 0) {
        sounds.playSuccess();
        triggerConfetti();
      } else {
        sounds.playDeduct();
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error adding family points:', err);
      setErrorMessage(err instanceof Error ? err.message : 'فشل تسجيل نقاط الأسرة');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-church-200 overflow-hidden text-right">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-church-800 via-church-700 to-church-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-xs">
              <Home size={20} className="text-yellow-300" />
            </div>
            <div>
              <h3 className="text-base font-black">إضافة نقاط مباشرة للأسرة</h3>
              <p className="text-[11px] text-church-200">النقاط المباشرة تضاف لإجمالي الأسرة فوراً</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Family Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">اختر الأسرة:</label>
            <select
              value={selectedFamId}
              onChange={(e) => setSelectedFamId(e.target.value)}
              className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-church-300 focus:ring-2 focus:ring-church-500 bg-white"
            >
              {families.map((fam) => (
                <option key={fam.id} value={fam.id}>
                  🏠 {fam.name} {fam.stage ? `(${fam.stage.name})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Operation Type Toggle */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">نوع العملية:</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('add')}
                className={`py-2 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 border-2 transition-all ${
                  type === 'add'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-800 shadow-sm'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <PlusCircle size={16} />
                إضافة نقاط (+)
              </button>
              <button
                type="button"
                onClick={() => setType('deduct')}
                className={`py-2 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 border-2 transition-all ${
                  type === 'deduct'
                    ? 'bg-rose-50 border-rose-600 text-rose-800 shadow-sm'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <MinusCircle size={16} />
                خصم نقاط (-)
              </button>
            </div>
          </div>

          {/* Points Amount & Quick Presets */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">عدد النقاط:</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="100"
                value={points}
                onChange={(e) => setPoints(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 text-center font-black text-lg py-2 rounded-xl border border-church-300 focus:ring-2 focus:ring-church-500"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {[1, 2, 5, 10, 20].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setPoints(val)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      points === val
                        ? 'bg-church-600 text-white border-church-600'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Reason Input & Quick Chips */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">السبب / ملاحظة:</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="اكتب سبب إضافة أو خصم النقاط..."
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-church-300 focus:ring-2 focus:ring-church-500 mb-2"
            />
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar">
              {COMMON_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className="text-[10px] font-medium bg-church-50 hover:bg-church-100 text-church-900 px-2 py-1 rounded-lg border border-church-200/80 transition-colors text-right"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Preview Banner */}
          <div
            className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-between border ${
              type === 'add'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <span>
              {type === 'add' ? 'سيتم إضافة' : 'سيتم خصم'}{' '}
              <strong className="font-black text-sm">{type === 'add' ? `+${points}` : `-${points}`}</strong> نقطة
              إلى أسرة ({currentFamily?.name || ''})
            </span>
            <Sparkles size={16} className={type === 'add' ? 'text-emerald-600' : 'text-rose-600'} />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 py-3 rounded-xl text-white font-black text-xs shadow-md transition-all active:scale-98 flex items-center justify-center gap-1.5 ${
                type === 'add'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              <span>{submitting ? 'جاري الحفظ...' : type === 'add' ? 'تأكيد إضافة النقاط للأسرة' : 'تأكيد خصم النقاط'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
