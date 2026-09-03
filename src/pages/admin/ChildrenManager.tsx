import React, { useState, useEffect } from 'react';
import { supabase, uploadMedia } from '../../lib/supabase';
import { Child, Family, Stage } from '../../types/database';
import { Users, Plus, Edit2, Trash2, Search, Filter, AlertCircle, Image as ImageIcon } from 'lucide-react';

export const ChildrenManager: React.FC = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStageId, setSelectedStageId] = useState<string>('all');
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('all');

  // Modal
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [fullName, setFullName] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [stageId, setStageId] = useState<string>('');
  const [familyId, setFamilyId] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [chRes, famRes, stgRes] = await Promise.all([
        supabase.from('children').select('*, stage:stages(*), family:families(*)').order('full_name'),
        supabase.from('families').select('*').eq('is_active', true).order('name'),
        supabase.from('stages').select('*').eq('is_active', true).order('sort_order'),
      ]);

      if (chRes.data) setChildren(chRes.data as Child[]);
      if (famRes.data) setFamilies(famRes.data as Family[]);
      if (stgRes.data) setStages(stgRes.data as Stage[]);
    } catch (err) {
      console.error('Error loading children data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditingChild(null);
    setFullName('');
    setCode('');
    const defaultStage = stages[0]?.id || '';
    setStageId(defaultStage);
    const firstFamilyInStage = families.find((f) => f.stage_id === defaultStage)?.id || families[0]?.id || '';
    setFamilyId(firstFamilyInStage);
    setImageUrl('');
    setErrorMessage(null);
    setModalOpen(true);
  };

  const openEditModal = (child: Child) => {
    setEditingChild(child);
    setFullName(child.full_name);
    setCode(child.code || '');
    setStageId(child.stage_id);
    setFamilyId(child.family_id);
    setImageUrl(child.image_url || '');
    setErrorMessage(null);
    setModalOpen(true);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const publicUrl = await uploadMedia(file, 'children');
      setImageUrl(publicUrl);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل رفع الصورة');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !stageId || !familyId) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      if (editingChild) {
        const { error } = await supabase
          .from('children')
          .update({
            full_name: fullName.trim(),
            code: code.trim() || null,
            stage_id: stageId,
            family_id: familyId,
            image_url: imageUrl || null,
          })
          .eq('id', editingChild.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('children').insert({
          full_name: fullName.trim(),
          code: code.trim() || null,
          stage_id: stageId,
          family_id: familyId,
          image_url: imageUrl || null,
          is_active: true,
        });

        if (error) throw error;
      }

      await fetchData();
      setModalOpen(false);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'فشلت العملية');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (child: Child) => {
    try {
      const next = !child.is_active;
      const { error } = await supabase
        .from('children')
        .update({ is_active: next })
        .eq('id', child.id);

      if (error) throw error;
      setChildren((prev) => prev.map((c) => (c.id === child.id ? { ...c, is_active: next } : c)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل تحديث الحالة');
    }
  };

  const handleDeleteChild = async (child: Child) => {
    if (!confirm(`هل أنت متأكد من حذف المخدوم "${child.full_name}"؟`)) return;

    try {
      const { error } = await supabase.from('children').delete().eq('id', child.id);
      if (error) throw error;
      setChildren((prev) => prev.filter((c) => c.id !== child.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل الحذف، يمكنك تعطيل حساب المخدوم بدلاً من ذلك');
    }
  };

  // Filtered children
  const filteredChildren = children.filter((c) => {
    if (selectedStageId !== 'all' && c.stage_id !== selectedStageId) return false;
    if (selectedFamilyId !== 'all' && c.family_id !== selectedFamilyId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.full_name.toLowerCase().includes(q);
      const matchCode = c.code ? c.code.toLowerCase().includes(q) : false;
      return matchName || matchCode;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-church-950 flex items-center gap-2">
            <Users className="text-church-600" />
            إدارة المخدومين (الأولاد)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إضافة وتعديل بيانات الأولاد، صورهم، وربطهم بالمراحل والأسر
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-2xl bg-church-600 hover:bg-church-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 self-start active:scale-95"
        >
          <Plus size={16} />
          إضافة مخدوم جديد
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-4 border border-church-200 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Stage filter */}
          <select
            value={selectedStageId}
            onChange={(e) => setSelectedStageId(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-church-300 bg-church-50 text-slate-800 font-bold focus:outline-none"
          >
            <option value="all">كل المراحل</option>
            {stages.map((stg) => (
              <option key={stg.id} value={stg.id}>
                {stg.name}
              </option>
            ))}
          </select>

          {/* Family filter */}
          <select
            value={selectedFamilyId}
            onChange={(e) => setSelectedFamilyId(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-church-300 bg-church-50 text-slate-800 font-bold focus:outline-none"
          >
            <option value="all">كل الأسر</option>
            {families.map((fam) => (
              <option key={fam.id} value={fam.id}>
                {fam.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو الكود..."
            className="w-full text-xs pr-9 pl-4 py-2.5 rounded-xl border border-church-300 focus:outline-none focus:ring-2 focus:ring-church-500 bg-church-50/50"
          />
          <Search size={16} className="absolute right-3 top-3 text-slate-400" />
        </div>
      </div>

      {/* Children Table */}
      {loading ? (
        <div className="text-center py-16">
          <div className="w-10 h-10 border-4 border-church-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs font-bold text-slate-600">جاري تحميل الأولاد...</p>
        </div>
      ) : filteredChildren.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-church-200">
          <Users size={48} className="text-church-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">لا يوجد مخدومين مطابقين للبحث</h3>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-church-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-church-50/80 border-b border-church-200 text-church-950 font-black">
                  <th className="py-4 px-6">المخدوم</th>
                  <th className="py-4 px-4">الكود الكنسي</th>
                  <th className="py-4 px-4">المرحلة</th>
                  <th className="py-4 px-4">الأسرة</th>
                  <th className="py-4 px-4">الحالة</th>
                  <th className="py-4 px-6 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-church-100 font-medium">
                {filteredChildren.map((child) => (
                  <tr key={child.id} className="hover:bg-church-50/40 transition-colors">
                    {/* Name + Photo */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl overflow-hidden border border-church-300 bg-church-100 flex items-center justify-center font-bold text-church-800 text-sm shadow-xs">
                          {child.image_url ? (
                            <img src={child.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            child.full_name.charAt(0)
                          )}
                        </div>
                        <div className="font-extrabold text-slate-900">{child.full_name}</div>
                      </div>
                    </td>

                    {/* Code */}
                    <td className="py-4 px-4 text-slate-500 font-mono text-[11px]">
                      {child.code || '—'}
                    </td>

                    {/* Stage */}
                    <td className="py-4 px-4">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-bold">
                        {child.stage?.name}
                      </span>
                    </td>

                    {/* Family */}
                    <td className="py-4 px-4">
                      <span className="px-2.5 py-1 rounded-lg bg-church-100 text-church-900 border border-church-200 text-[11px] font-bold">
                        {child.family?.name}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          child.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {child.is_active ? 'نشط' : 'معطل'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleToggleActive(child)}
                          className="text-xs font-semibold text-slate-500 hover:text-church-800 px-2 py-1"
                        >
                          {child.is_active ? 'تعطيل' : 'تفعيل'}
                        </button>
                        <button
                          onClick={() => openEditModal(child)}
                          className="p-1.5 text-church-600 hover:bg-church-50 rounded-xl"
                          title="تعديل"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteChild(child)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-xl"
                          title="حذف"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Child Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-church-200 overflow-hidden">
            <div className="bg-gradient-to-r from-church-700 to-church-800 text-white p-5 flex items-center justify-between">
              <h3 className="text-base font-black">
                {editingChild ? 'تعديل بيانات المخدوم' : 'إضافة مخدوم جديد'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-church-200 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveChild} className="p-6 space-y-4 text-right">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المخدوم بالكامل:</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: بولا رأفت، ماريو سامي..."
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-church-300 focus:outline-none focus:ring-2 focus:ring-church-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الكود الكنسي / الباركود (اختياري):</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="مثال: 1045"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-church-300 focus:outline-none focus:ring-2 focus:ring-church-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المرحلة:</label>
                  <select
                    required
                    value={stageId}
                    onChange={(e) => {
                      const newStage = e.target.value;
                      setStageId(newStage);
                      // Auto pick first family in that stage
                      const firstFam = families.find((f) => f.stage_id === newStage);
                      if (firstFam) setFamilyId(firstFam.id);
                    }}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-church-300 focus:outline-none focus:ring-2 focus:ring-church-500 bg-white"
                  >
                    {stages.map((stg) => (
                      <option key={stg.id} value={stg.id}>
                        {stg.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الأسرة:</label>
                  <select
                    required
                    value={familyId}
                    onChange={(e) => setFamilyId(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-church-300 focus:outline-none focus:ring-2 focus:ring-church-500 bg-white"
                  >
                    {families
                      .filter((f) => f.stage_id === stageId)
                      .map((fam) => (
                        <option key={fam.id} value={fam.id}>
                          {fam.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">صورة المخدوم:</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-church-100 file:text-church-900 hover:file:bg-church-200 cursor-pointer"
                  />
                  {uploadingImage && <span className="text-xs text-church-600 font-bold">جاري الرفع...</span>}
                </div>
                {imageUrl && (
                  <div className="mt-2 w-16 h-16 rounded-xl overflow-hidden border border-church-300">
                    <img src={imageUrl} alt="Child avatar" className="w-full h-full object-cover" />
                  </div>
                )}
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
                  disabled={submitting || uploadingImage}
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
