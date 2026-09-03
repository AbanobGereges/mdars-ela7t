import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { PointRule, PointRuleType } from '../../types/database';
import { Award, Plus, Edit2, Trash2, CheckCircle2, XCircle, AlertCircle, PlusCircle, MinusCircle } from 'lucide-react';

export const PointRulesManager: React.FC = () => {
  const [rules, setRules] = useState<PointRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<PointRule | null>(null);
  const [title, setTitle] = useState<string>('');
  const [points, setPoints] = useState<number>(1);
  const [type, setType] = useState<PointRuleType>('add');
  const [description, setDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchRules = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('point_rules')
      .select('*')
      .order('points', { ascending: false });

    if (data) setRules(data as PointRule[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const openAddModal = () => {
    setEditingRule(null);
    setTitle('');
    setPoints(2);
    setType('add');
    setDescription('');
    setErrorMessage(null);
    setModalOpen(true);
  };

  const openEditModal = (rule: PointRule) => {
    setEditingRule(rule);
    setTitle(rule.title);
    setPoints(Math.abs(rule.points));
    setType(rule.type);
    setDescription(rule.description || '');
    setErrorMessage(null);
    setModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || points <= 0) return;

    setSubmitting(true);
    setErrorMessage(null);

    // Calculated signed points (+ for add, - for deduct)
    const signedPoints = type === 'add' ? Math.abs(points) : -Math.abs(points);

    try {
      if (editingRule) {
        const { error } = await supabase
          .from('point_rules')
          .update({
            title: title.trim(),
            points: signedPoints,
            type: type,
            description: description.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingRule.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('point_rules').insert({
          title: title.trim(),
          points: signedPoints,
          type: type,
          description: description.trim() || null,
          is_active: true,
        });

        if (error) throw error;
      }

      await fetchRules();
      setModalOpen(false);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'فشلت العملية');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (rule: PointRule) => {
    try {
      const next = !rule.is_active;
      const { error } = await supabase
        .from('point_rules')
        .update({ is_active: next, updated_at: new Date().toISOString() })
        .eq('id', rule.id);

      if (error) throw error;
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, is_active: next } : r)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل تحديث الحالة');
    }
  };

  const handleDeleteRule = async (rule: PointRule) => {
    if (!confirm(`هل أنت متأكد من حذف بند "${rule.title}"؟`)) return;

    try {
      const { error } = await supabase.from('point_rules').delete().eq('id', rule.id);
      if (error) throw error;
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch (err: unknown) {
      alert(
        err instanceof Error
          ? err.message
          : 'لا يمكن حذف البند لوجود سجلات نقاط سابقة اعتمدت عليه. يرجى تعطيل البند بدلاً من حذفه.'
      );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-church-950 flex items-center gap-2">
            <Award className="text-church-600" />
            لوحة إعدادات قواعد النقاط
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إدارة ديناميكية كاملة لبنود الإضافة والخصم بدون لمس الكود، وتعديل النقاط وتفعيلها
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-2xl bg-church-600 hover:bg-church-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 self-start active:scale-95"
        >
          <Plus size={16} />
          إضافة بند نقاط جديد
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="w-10 h-10 border-4 border-church-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs font-bold text-slate-600">جاري تحميل القواعد...</p>
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-church-200">
          <Award size={48} className="text-church-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">لا توجد قواعد نقاط مضافة</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {rules.map((rule) => {
            const isAdd = rule.type === 'add';

            return (
              <div
                key={rule.id}
                className={`bg-white rounded-3xl border-2 p-5 flex flex-col justify-between shadow-sm transition-all hover:shadow-md ${
                  rule.is_active
                    ? isAdd
                      ? 'border-emerald-200/80 hover:border-emerald-400'
                      : 'border-rose-200/80 hover:border-rose-400'
                    : 'border-slate-200 opacity-60'
                }`}
              >
                <div>
                  {/* Top Bar: Value badge & Status */}
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`w-12 h-12 rounded-2xl font-black text-xl flex items-center justify-center shadow-xs ${
                        isAdd ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {isAdd ? `+${rule.points}` : rule.points}
                    </span>

                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        rule.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {rule.is_active ? 'مفعل' : 'معطل'}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-slate-900">{rule.title}</h3>
                  {rule.description && (
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{rule.description}</p>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="mt-5 pt-3 border-t border-church-100 flex items-center justify-between">
                  <button
                    onClick={() => handleToggleActive(rule)}
                    className="text-xs font-semibold text-slate-500 hover:text-church-800"
                  >
                    {rule.is_active ? 'تعطيل' : 'تفعيل'}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(rule)}
                      className="p-1.5 text-church-600 hover:bg-church-50 rounded-xl"
                      title="تعديل البند"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-xl"
                      title="حذف البند"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Rule Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-church-200 overflow-hidden">
            <div className="bg-gradient-to-r from-church-700 to-church-800 text-white p-5 flex items-center justify-between">
              <h3 className="text-base font-black">
                {editingRule ? 'تعديل بند النقاط' : 'إضافة بند نقاط جديد'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-church-200 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="p-6 space-y-4 text-right">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Type Switcher */}
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم البند:</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: حفظ آية، الهدوء، التأخير..."
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-church-300 focus:outline-none focus:ring-2 focus:ring-church-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عدد النقاط:</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="100"
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-church-300 focus:outline-none focus:ring-2 focus:ring-church-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  سيتم تسجيلها كـ {type === 'add' ? `+${points}` : `-${points}`} في حساب المخدوم.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">وصف البند (اختياري):</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="تفاصيل متى تُمنح هذه النقطة..."
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-church-300 focus:outline-none focus:ring-2 focus:ring-church-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 rounded-xl text-xs font-black bg-church-600 hover:bg-church-700 text-white shadow-md transition-all active:scale-95"
                >
                  {submitting ? 'جاري الحفظ...' : 'حفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
