import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Stage } from '../../types/database';
import { Layers, Plus, Edit2, Trash2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export const StagesManager: React.FC = () => {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [stageName, setStageName] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchStages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('stages')
      .select('*')
      .order('sort_order', { ascending: true });

    if (data) setStages(data as Stage[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchStages();
  }, []);

  const openAddModal = () => {
    setEditingStage(null);
    setStageName('');
    setSortOrder(stages.length + 1);
    setErrorMessage(null);
    setModalOpen(true);
  };

  const openEditModal = (stage: Stage) => {
    setEditingStage(stage);
    setStageName(stage.name);
    setSortOrder(stage.sort_order);
    setErrorMessage(null);
    setModalOpen(true);
  };

  const handleSaveStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageName.trim()) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      if (editingStage) {
        // Update
        const { error } = await supabase
          .from('stages')
          .update({
            name: stageName.trim(),
            sort_order: Number(sortOrder) || 1,
          })
          .eq('id', editingStage.id);

        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase.from('stages').insert({
          name: stageName.trim(),
          sort_order: Number(sortOrder) || 1,
          is_active: true,
        });

        if (error) throw error;
      }

      await fetchStages();
      setModalOpen(false);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'فشلت العملية، تأكد من عدم تكرار الاسم');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (stage: Stage) => {
    try {
      const next = !stage.is_active;
      const { error } = await supabase
        .from('stages')
        .update({ is_active: next })
        .eq('id', stage.id);

      if (error) throw error;
      setStages((prev) => prev.map((s) => (s.id === stage.id ? { ...s, is_active: next } : s)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل تحديث الحالة');
    }
  };

  const handleDeleteStage = async (stage: Stage) => {
    if (!confirm(`هل أنت متأكد من حذف المرحلة "${stage.name}"؟ سيتم رفض الحذف إذا كانت هناك أسر مرتبطة بها.`)) {
      return;
    }

    try {
      const { error } = await supabase.from('stages').delete().eq('id', stage.id);
      if (error) throw error;
      setStages((prev) => prev.filter((s) => s.id !== stage.id));
    } catch (err: unknown) {
      alert(
        err instanceof Error
          ? err.message
          : 'لا يمكن حذف المرحلة لأنها تحتوي على أسر أو مخدومين مرتبطين بها. يمكنك تعطيلها بدلاً من الحذف.'
      );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-church-950 flex items-center gap-2">
            <Layers className="text-church-600" />
            إدارة المراحل الدراسية
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إضافة وتعديل المراحل (مثل: 1 ابتدائي، 2 ابتدائي، 3 ابتدائي) والتحكم في ترتيبها وتفعيلها
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-2xl bg-church-600 hover:bg-church-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 self-start active:scale-95"
        >
          <Plus size={16} />
          إضافة مرحلة جديدة
        </button>
      </div>

      {/* Stages Grid */}
      {loading ? (
        <div className="text-center py-16">
          <div className="w-10 h-10 border-4 border-church-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs font-bold text-slate-600">جاري تحميل المراحل...</p>
        </div>
      ) : stages.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-church-200">
          <Layers size={48} className="text-church-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">لا توجد مراحل مضافة</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className={`bg-white rounded-3xl p-5 border-2 transition-all shadow-sm flex flex-col justify-between ${
                stage.is_active ? 'border-church-200 hover:border-church-400' : 'border-slate-200 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="w-8 h-8 rounded-xl bg-church-100 font-black text-xs text-church-800 flex items-center justify-center">
                    #{stage.sort_order}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      stage.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {stage.is_active ? 'نشطة' : 'معطلة'}
                  </span>
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-1">{stage.name}</h3>
              </div>

              <div className="mt-6 pt-4 border-t border-church-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleToggleActive(stage)}
                  className="text-xs font-bold text-slate-600 hover:text-church-800"
                >
                  {stage.is_active ? 'تعطيل' : 'تفعيل'}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(stage)}
                    className="p-2 text-church-600 hover:bg-church-50 rounded-xl transition-colors"
                    title="تعديل المرحلة"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteStage(stage)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                    title="حذف المرحلة"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-church-200 overflow-hidden">
            <div className="bg-gradient-to-r from-church-700 to-church-800 text-white p-5 flex items-center justify-between">
              <h3 className="text-base font-black">
                {editingStage ? 'تعديل المرحلة' : 'إضافة مرحلة جديدة'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-church-200 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStage} className="p-6 space-y-4 text-right">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المرحلة:</label>
                <input
                  type="text"
                  required
                  value={stageName}
                  onChange={(e) => setStageName(e.target.value)}
                  placeholder="مثال: 1 ابتدائي، 4 ابتدائي..."
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-church-300 focus:outline-none focus:ring-2 focus:ring-church-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ترتيب العرض:</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
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
