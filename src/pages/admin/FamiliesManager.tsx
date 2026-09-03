import React, { useState, useEffect } from 'react';
import { supabase, uploadMedia } from '../../lib/supabase';
import { Family, Stage, Child, Profile, FamilyServant } from '../../types/database';
import {
  Home,
  Plus,
  Edit2,
  Trash2,
  Users,
  Image as ImageIcon,
  UserCheck,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  PlusCircle,
} from 'lucide-react';
import { FamilyPointsModal } from '../../components/common/FamilyPointsModal';

export const FamiliesManager: React.FC = () => {
  const [families, setFamilies] = useState<Family[]>([]);
  const [familyPointsModalOpen, setFamilyPointsModalOpen] = useState<boolean>(false);
  const [targetFamilyForPoints, setTargetFamilyForPoints] = useState<string | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [servants, setServants] = useState<Profile[]>([]);
  const [familyServants, setFamilyServants] = useState<FamilyServant[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal states
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);
  const [familyName, setFamilyName] = useState<string>('');
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Family Detail Drawer / View
  const [activeFamilyDetail, setActiveFamilyDetail] = useState<Family | null>(null);

  const fetchFamiliesData = async () => {
    setLoading(true);
    try {
      const [famsRes, stgsRes, servRes, fsRes, chRes] = await Promise.all([
        supabase.from('families').select('*').order('name'),
        supabase.from('stages').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('profiles').select('*').eq('role', 'servant').eq('is_approved', true),
        supabase.from('family_servants').select('*'),
        supabase.from('children').select('*'),
      ]);

      const stagesData = (stgsRes.data as Stage[]) || [];
      const servantsData = (servRes.data as Profile[]) || [];
      const fsData = (fsRes.data as FamilyServant[]) || [];

      if (stgsRes.data) setStages(stagesData);
      if (servRes.data) setServants(servantsData);
      if (chRes.data) setChildren(chRes.data as Child[]);

      if (fsRes.data) {
        const enrichedFs = fsData.map((fs) => ({
          ...fs,
          servant: servantsData.find((s) => s.id === fs.servant_id),
        }));
        setFamilyServants(enrichedFs);
      }

      if (famsRes.data) {
        const enrichedFams = (famsRes.data as Family[]).map((f) => ({
          ...f,
          stage: stagesData.find((s) => s.id === f.stage_id),
        }));
        setFamilies(enrichedFams);
      }
    } catch (err) {
      console.error('Error fetching families:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFamiliesData();
  }, []);

  const openAddModal = () => {
    setEditingFamily(null);
    setFamilyName('');
    setSelectedStageId(stages[0]?.id || '');
    setImageUrl('');
    setErrorMessage(null);
    setModalOpen(true);
  };

  const openEditModal = (family: Family) => {
    setEditingFamily(family);
    setFamilyName(family.name);
    setSelectedStageId(family.stage_id);
    setImageUrl(family.image_url || '');
    setErrorMessage(null);
    setModalOpen(true);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const publicUrl = await uploadMedia(file, 'families');
      setImageUrl(publicUrl);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل رفع الصورة');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyName.trim() || !selectedStageId) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      if (editingFamily) {
        const { error } = await supabase
          .from('families')
          .update({
            name: familyName.trim(),
            stage_id: selectedStageId,
            image_url: imageUrl || null,
          })
          .eq('id', editingFamily.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('families').insert({
          name: familyName.trim(),
          stage_id: selectedStageId,
          image_url: imageUrl || null,
          is_active: true,
        });

        if (error) throw error;
      }

      await fetchFamiliesData();
      setModalOpen(false);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'فشلت العملية');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (family: Family) => {
    try {
      const next = !family.is_active;
      const { error } = await supabase
        .from('families')
        .update({ is_active: next })
        .eq('id', family.id);

      if (error) throw error;
      setFamilies((prev) => prev.map((f) => (f.id === family.id ? { ...f, is_active: next } : f)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل تحديث الحالة');
    }
  };

  const handleDeleteFamily = async (family: Family) => {
    if (!confirm(`هل أنت متأكد من حذف أسرة "${family.name}"؟`)) return;

    try {
      const { error } = await supabase.from('families').delete().eq('id', family.id);
      if (error) throw error;
      setFamilies((prev) => prev.filter((f) => f.id !== family.id));
    } catch (err: unknown) {
      alert(
        err instanceof Error
          ? err.message
          : 'لا يمكن حذف الأسرة لاحتوائها على أولاد أو سجلات نقاط مرتبطة. يرجى تعطيلها بدلاً من الحذف.'
      );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-church-950 flex items-center gap-2">
            <Home className="text-church-600" />
            إدارة أسر الخدمة
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إضافة وتعديل الأسر، ربطها بالمراحل، صور الأسر، وإسناد الخدام ومتابعة الأولاد
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setTargetFamilyForPoints(null);
              setFamilyPointsModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-yellow-950 font-black text-xs shadow-md transition-all flex items-center gap-1.5 active:scale-95"
          >
            <PlusCircle size={16} />
            <span>إضافة نقاط للأسرة</span>
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2.5 rounded-2xl bg-church-600 hover:bg-church-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 active:scale-95"
          >
            <Plus size={16} />
            إضافة أسرة جديدة
          </button>
        </div>
      </div>

      {/* Families Grid */}
      {loading ? (
        <div className="text-center py-16">
          <div className="w-10 h-10 border-4 border-church-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs font-bold text-slate-600">جاري تحميل الأسر...</p>
        </div>
      ) : families.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-church-200">
          <Home size={48} className="text-church-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">لا توجد أسر مضافة بعد</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {families.map((fam) => {
            const famKids = children.filter((c) => c.family_id === fam.id && c.is_active);
            const famServants = familyServants.filter((fs) => fs.family_id === fam.id);

            return (
              <div
                key={fam.id}
                className={`bg-white rounded-3xl border-2 p-5 flex flex-col justify-between shadow-sm transition-all hover:shadow-md ${
                  fam.is_active ? 'border-church-200 hover:border-church-400' : 'border-slate-200 opacity-60'
                }`}
              >
                <div>
                  {/* Top Bar: Stage badge & status */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-3 py-1 rounded-xl bg-church-100 text-church-900 border border-church-200 text-xs font-bold">
                      📚 {fam.stage?.name}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        fam.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {fam.is_active ? 'نشطة' : 'معطلة'}
                    </span>
                  </div>

                  {/* Family image + Name */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-church-300 shadow-inner bg-church-50 flex items-center justify-center text-church-600">
                      {fam.image_url ? (
                        <img src={fam.image_url} alt={fam.name} className="w-full h-full object-cover" />
                      ) : (
                        <Home size={28} />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900">{fam.name}</h3>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <Users size={12} />
                        <span>{famKids.length} مخدوم</span>
                      </div>
                    </div>
                  </div>

                  {/* Servants assigned */}
                  <div className="bg-church-50/60 rounded-2xl p-3 border border-church-100 text-xs">
                    <span className="font-bold text-slate-600 block mb-1">الخدام المسؤولون:</span>
                    {famServants.length === 0 ? (
                      <span className="text-slate-400 text-[11px]">لم يتم تعيين خدام لهذه الأسرة بعد</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {famServants.map((fs) => (
                          <span
                            key={fs.id}
                            className="bg-white px-2 py-0.5 rounded-lg border border-church-200 text-slate-800 font-semibold text-[11px]"
                          >
                            🙋 {fs.servant?.full_name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-3 border-t border-church-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setTargetFamilyForPoints(fam.id);
                        setFamilyPointsModalOpen(true);
                      }}
                      className="text-xs font-bold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1 transition-colors"
                      title="إضافة نقاط مباشرة لهذه الأسرة"
                    >
                      <PlusCircle size={13} />
                      <span>نقاط للأسرة</span>
                    </button>
                    <button
                      onClick={() => setActiveFamilyDetail(fam)}
                      className="text-xs font-bold text-church-700 hover:text-church-900 flex items-center gap-1"
                    >
                      <span>صفحة الأسرة</span>
                      <ExternalLink size={14} />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleActive(fam)}
                      className="text-xs font-semibold text-slate-500 hover:text-church-800 px-2 py-1"
                    >
                      {fam.is_active ? 'تعطيل' : 'تفعيل'}
                    </button>
                    <button
                      onClick={() => openEditModal(fam)}
                      className="p-1.5 text-church-600 hover:bg-church-50 rounded-xl"
                      title="تعديل"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteFamily(fam)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-xl"
                      title="حذف"
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

      {/* Add / Edit Family Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-church-200 overflow-hidden">
            <div className="bg-gradient-to-r from-church-700 to-church-800 text-white p-5 flex items-center justify-between">
              <h3 className="text-base font-black">
                {editingFamily ? 'تعديل بيانات الأسرة' : 'إضافة أسرة جديدة'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-church-200 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFamily} className="p-6 space-y-4 text-right">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الأسرة:</label>
                <input
                  type="text"
                  required
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="مثال: أسرة الملاك ميخائيل، أسرة النور..."
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-church-300 focus:outline-none focus:ring-2 focus:ring-church-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المرحلة الدراسية التابعة لها:</label>
                <select
                  required
                  value={selectedStageId}
                  onChange={(e) => setSelectedStageId(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-church-300 focus:outline-none focus:ring-2 focus:ring-church-500 bg-white"
                >
                  <option value="">اختر المرحلة</option>
                  {stages.map((stg) => (
                    <option key={stg.id} value={stg.id}>
                      {stg.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">صورة / شعار الأسرة:</label>
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
                    <img src={imageUrl} alt="Family logo" className="w-full h-full object-cover" />
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

      {/* Family Detail Drawer Modal */}
      {activeFamilyDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-church-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-gradient-to-r from-church-700 to-church-800 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/40 bg-white/20 flex items-center justify-center">
                  {activeFamilyDetail.image_url ? (
                    <img src={activeFamilyDetail.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Home size={24} />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-black">{activeFamilyDetail.name}</h3>
                  <p className="text-xs text-church-200 font-semibold">{activeFamilyDetail.stage?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveFamilyDetail(null)}
                className="text-white hover:bg-white/20 p-2 rounded-full"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Kids list */}
              <div>
                <h4 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                  <Users size={16} className="text-church-600" />
                  أولاد الأسرة ({children.filter((c) => c.family_id === activeFamilyDetail.id).length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {children
                    .filter((c) => c.family_id === activeFamilyDetail.id)
                    .map((child) => (
                      <div
                        key={child.id}
                        className="p-3 rounded-2xl bg-church-50 border border-church-200 flex items-center gap-3"
                      >
                        <div className="w-10 h-10 rounded-xl bg-church-200 flex items-center justify-center font-bold text-church-800 overflow-hidden">
                          {child.image_url ? (
                            <img src={child.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            child.full_name.charAt(0)
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-900">{child.full_name}</div>
                          <div className="text-[10px] text-slate-400">كود: {child.code || 'بدون كود'}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-church-50 border-t border-church-200 text-right">
              <button
                onClick={() => setActiveFamilyDetail(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-church-600 text-white"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      <FamilyPointsModal
        isOpen={familyPointsModalOpen}
        onClose={() => setFamilyPointsModalOpen(false)}
        onSuccess={() => {
          fetchFamiliesData();
        }}
        families={families}
        preSelectedFamilyId={targetFamilyForPoints}
      />
    </div>
  );
};
