import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Group, Stage, Profile, Child } from '../../types/database';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  Power,
  Shield,
  Sparkles,
  BookOpen,
  FolderKanban,
  Check,
  Search,
  UserPlus,
  RefreshCw,
} from 'lucide-react';

interface GroupWithDetails extends Group {
  stages: Stage[];
  stage_ids: string[];
  servants: Profile[];
  servants_count: number;
  children_count: number;
}

export const StagesAndGroupsManager: React.FC = () => {
  const [groups, setGroups] = useState<GroupWithDetails[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [allServants, setAllServants] = useState<Profile[]>([]);
  const [allChildren, setAllChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Group Create/Edit Modal
  const [groupModalOpen, setGroupModalOpen] = useState<boolean>(false);
  const [editingGroup, setEditingGroup] = useState<GroupWithDetails | null>(null);
  const [groupName, setGroupName] = useState<string>('');
  const [groupDesc, setGroupDesc] = useState<string>('');
  const [selectedStageIds, setSelectedStageIds] = useState<string[]>([]);
  const [groupIsActive, setGroupIsActive] = useState<boolean>(true);
  const [selectedServantIds, setSelectedServantIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Servants Management Modal for a group
  const [servantsModalOpen, setServantsModalOpen] = useState<boolean>(false);
  const [activeGroupForServants, setActiveGroupForServants] = useState<GroupWithDetails | null>(null);
  const [servantsSearch, setServantsSearch] = useState<string>('');
  const [savingServants, setSavingServants] = useState<boolean>(false);

  // Active view tab: 'groups' | 'stages'
  const [activeTab, setActiveTab] = useState<'groups' | 'stages'>('groups');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [grpRes, stgRes, gstgRes, gservRes, profRes, chRes] = await Promise.all([
        supabase.from('groups').select('*').order('created_at', { ascending: true }),
        supabase.from('stages').select('*').order('sort_order', { ascending: true }),
        supabase.from('group_stages').select('*'),
        supabase.from('group_servants').select('*'),
        supabase.from('profiles').select('*').eq('role', 'servant').eq('is_approved', true).order('full_name'),
        supabase.from('children').select('id, stage_id, is_active'),
      ]);

      const rawGroups = (grpRes.data as Group[]) || [];
      const rawStages = (stgRes.data as Stage[]) || [];
      const rawGroupStages = (gstgRes.data as { group_id: string; stage_id: string }[]) || [];
      const rawGroupServants = (gservRes.data as { group_id: string; servant_id: string }[]) || [];
      const rawServants = (profRes.data as Profile[]) || [];
      const rawChildren = (chRes.data as Child[]) || [];

      setStages(rawStages);
      setAllServants(rawServants);
      setAllChildren(rawChildren);

      // Build detailed groups
      const detailed: GroupWithDetails[] = rawGroups.map((g) => {
        const linkedStageIds = rawGroupStages
          .filter((gs) => gs.group_id === g.id)
          .map((gs) => gs.stage_id);

        const groupStages = rawStages.filter((s) => linkedStageIds.includes(s.id));

        const linkedServantIds = rawGroupServants
          .filter((gs) => gs.group_id === g.id)
          .map((gs) => gs.servant_id);

        const groupServants = rawServants.filter((s) => linkedServantIds.includes(s.id));

        // Children belonging to stages of this group
        const groupChildrenCount = rawChildren.filter(
          (c) => linkedStageIds.includes(c.stage_id) && c.is_active !== false
        ).length;

        return {
          ...g,
          stages: groupStages,
          stage_ids: linkedStageIds,
          servants: groupServants,
          servants_count: groupServants.length,
          children_count: groupChildrenCount,
        };
      });

      setGroups(detailed);
    } catch (err) {
      console.error('Failed to load stages and groups data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Open modal to add new group
  const handleOpenAddModal = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupDesc('');
    setSelectedStageIds(stages.map((s) => s.id)); // Default all or first
    setGroupIsActive(true);
    setSelectedServantIds([]);
    setModalError(null);
    setGroupModalOpen(true);
  };

  // Open modal to edit existing group
  const handleOpenEditModal = (grp: GroupWithDetails) => {
    setEditingGroup(grp);
    setGroupName(grp.name);
    setGroupDesc(grp.description || '');
    setSelectedStageIds([...grp.stage_ids]);
    setGroupIsActive(grp.is_active);
    setSelectedServantIds(grp.servants.map((s) => s.id));
    setModalError(null);
    setGroupModalOpen(true);
  };

  // Toggle stage selection for group
  const toggleStageSelection = (stageId: string) => {
    setSelectedStageIds((prev) =>
      prev.includes(stageId) ? prev.filter((id) => id !== stageId) : [...prev, stageId]
    );
  };

  // Save Group (Create or Update)
  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setModalError('يرجى كتابة اسم المجموعة');
      return;
    }
    if (selectedStageIds.length === 0) {
      setModalError('يجب تحديد مرحلة واحدة على الأقل للمجموعة');
      return;
    }

    setSubmitting(true);
    setModalError(null);

    try {
      let groupId = editingGroup?.id;

      if (editingGroup) {
        // Update existing group
        const { error: updError } = await supabase
          .from('groups')
          .update({
            name: groupName.trim(),
            description: groupDesc.trim() || null,
            is_active: groupIsActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingGroup.id);

        if (updError) throw updError;
      } else {
        // Insert new group
        const { data: newGrp, error: insError } = await supabase
          .from('groups')
          .insert({
            name: groupName.trim(),
            description: groupDesc.trim() || null,
            is_active: groupIsActive,
          })
          .select('id')
          .single();

        if (insError) throw insError;
        groupId = newGrp.id;
      }

      if (groupId) {
        // 1. Update group_stages mapping
        await supabase.from('group_stages').delete().eq('group_id', groupId);
        if (selectedStageIds.length > 0) {
          const stageRows = selectedStageIds.map((stgId) => ({
            group_id: groupId as string,
            stage_id: stgId,
          }));
          const { error: stgMapError } = await supabase.from('group_stages').insert(stageRows);
          if (stgMapError) throw stgMapError;
        }

        // 2. Update group_servants mapping if provided
        await supabase.from('group_servants').delete().eq('group_id', groupId);
        if (selectedServantIds.length > 0) {
          const servantRows = selectedServantIds.map((srvId) => ({
            group_id: groupId as string,
            servant_id: srvId,
          }));
          const { error: srvMapError } = await supabase.from('group_servants').insert(servantRows);
          if (srvMapError) throw srvMapError;
        }
      }

      await fetchData();
      setGroupModalOpen(false);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'فشل حفظ المجموعة، تأكد من عدم تكرار الاسم');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Group Active / Inactive status directly
  const handleToggleGroupActive = async (grp: GroupWithDetails) => {
    try {
      const nextState = !grp.is_active;
      const { error } = await supabase
        .from('groups')
        .update({ is_active: nextState, updated_at: new Date().toISOString() })
        .eq('id', grp.id);

      if (error) throw error;
      setGroups((prev) =>
        prev.map((g) => (g.id === grp.id ? { ...g, is_active: nextState } : g))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل تغيير حالة تفعيل المجموعة');
    }
  };

  // Open Servants Assignment modal
  const handleOpenServantsModal = (grp: GroupWithDetails) => {
    setActiveGroupForServants(grp);
    setSelectedServantIds(grp.servants.map((s) => s.id));
    setServantsSearch('');
    setServantsModalOpen(true);
  };

  // Save Servants Assignment
  const handleSaveGroupServants = async () => {
    if (!activeGroupForServants) return;
    setSavingServants(true);

    try {
      const gId = activeGroupForServants.id;
      await supabase.from('group_servants').delete().eq('group_id', gId);

      if (selectedServantIds.length > 0) {
        const rows = selectedServantIds.map((sId) => ({
          group_id: gId,
          servant_id: sId,
        }));
        const { error } = await supabase.from('group_servants').insert(rows);
        if (error) throw error;
      }

      await fetchData();
      setServantsModalOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل تحديث خدام المجموعة');
    } finally {
      setSavingServants(false);
    }
  };

  // Toggle servant selection
  const toggleServantSelection = (servantId: string) => {
    setSelectedServantIds((prev) =>
      prev.includes(servantId) ? prev.filter((id) => id !== servantId) : [...prev, servantId]
    );
  };

  // Delete Group (Safe delete with confirm)
  const handleDeleteGroup = async (grp: GroupWithDetails) => {
    if (
      !confirm(
        `هل أنت متأكد من حذف المجموعة "${grp.name}"؟\nسيتم فك ارتباط المراحل والخدام بها بدون حذف بياناتهم.`
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase.from('groups').delete().eq('id', grp.id);
      if (error) throw error;
      setGroups((prev) => prev.filter((g) => g.id !== grp.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل حذف المجموعة');
    }
  };

  // Stage Badge Helper
  const getStageBadgeStyle = (stageName: string) => {
    if (stageName.includes('ابتدائي')) {
      return 'bg-amber-100 text-amber-900 border-amber-300';
    }
    if (stageName.includes('إعدادي')) {
      return 'bg-sky-100 text-sky-900 border-sky-300';
    }
    if (stageName.includes('ثانوي')) {
      return 'bg-purple-100 text-purple-900 border-purple-300';
    }
    return 'bg-emerald-100 text-emerald-900 border-emerald-300';
  };

  const getStageIcon = (stageName: string) => {
    if (stageName.includes('ابتدائي')) return '🎒';
    if (stageName.includes('إعدادي')) return '📘';
    if (stageName.includes('ثانوي')) return '🎓';
    return '⛪';
  };

  // Filtered groups
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.description && g.description.toLowerCase().includes(q)) ||
        g.stages.some((s) => s.name.toLowerCase().includes(q))
    );
  }, [groups, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-church-100 text-church-900 px-3 py-1 rounded-full text-xs font-bold mb-2 border border-church-200">
            <FolderKanban size={14} className="text-church-700" />
            <span>نظام التحكم في المجموعات والمراحل</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-church-950 flex items-center gap-2">
            إدارة المراحل والمجموعات
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            إنشاء وتعديل المجموعات، تحديد المراحل المتاحة لكل مجموعة، وعزل الصلاحيات والبيانات عبر Supabase RLS
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2.5 rounded-2xl bg-white hover:bg-church-50 border border-church-200 text-slate-700 font-bold text-xs shadow-xs transition-all"
            title="تحديث البيانات"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 rounded-2xl bg-church-600 hover:bg-church-700 text-white font-black text-xs shadow-md transition-all flex items-center gap-2 active:scale-95"
          >
            <Plus size={16} />
            <span>إنشاء مجموعة جديدة</span>
          </button>
        </div>
      </div>

      {/* Stats Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-3xl border border-church-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <FolderKanban size={22} />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{groups.length}</div>
            <div className="text-xs text-slate-500 font-semibold">إجمالي المجموعات</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-church-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {groups.filter((g) => g.is_active).length}
            </div>
            <div className="text-xs text-slate-500 font-semibold">مجموعات نشطة</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-church-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Layers size={22} />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{stages.length}</div>
            <div className="text-xs text-slate-500 font-semibold">المراحل الأساسية (3)</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-church-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <Users size={22} />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{allServants.length}</div>
            <div className="text-xs text-slate-500 font-semibold">الخدام المتاحين</div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher: Groups / Stages */}
      <div className="flex border-b border-church-200 gap-4">
        <button
          onClick={() => setActiveTab('groups')}
          className={`pb-3 px-2 text-sm font-black flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'groups'
              ? 'border-church-600 text-church-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FolderKanban size={16} />
          <span>جدول إدارة المجموعات ({groups.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('stages')}
          className={`pb-3 px-2 text-sm font-black flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'stages'
              ? 'border-church-600 text-church-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers size={16} />
          <span>المراحل الأساسية ({stages.length})</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: GROUPS MANAGEMENT TABLE (المطلوبة بالتفصيل)       */}
      {/* ======================================================== */}
      {activeTab === 'groups' && (
        <div className="bg-white rounded-3xl border border-church-200/90 shadow-sm overflow-hidden">
          {/* Table Search bar */}
          <div className="p-4 sm:p-5 border-b border-church-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-church-50/40">
            <div className="relative flex-1 max-w-md">
              <Search
                size={18}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="ابحث باسم المجموعة أو المراحل المتاحة لها..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 bg-white rounded-2xl border border-church-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-church-500/30"
              />
            </div>
            <div className="text-xs font-bold text-slate-500">
              إجمالي النتائج: {filteredGroups.length} مجموعة
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <div className="w-10 h-10 border-4 border-church-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-xs font-bold text-slate-600">جاري تحميل المجموعات والصلاحيات...</p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="py-16 text-center">
              <FolderKanban size={48} className="text-church-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">لا توجد مجموعات مطابقة</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                يمكنك الضغط على زر "إنشاء مجموعة جديدة" بالأعلى لإضافة مجموعات للمراحل المطلوبة
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-church-100/50 text-church-900 border-b border-church-200 font-black">
                    <th className="py-4 px-4 sm:px-6">اسم المجموعة</th>
                    <th className="py-4 px-4">المراحل المتاحة لها</th>
                    <th className="py-4 px-4 text-center">عدد الخدام</th>
                    <th className="py-4 px-4 text-center">عدد المخدومين</th>
                    <th className="py-4 px-4 text-center">حالة المجموعة</th>
                    <th className="py-4 px-4 sm:px-6 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-church-100">
                  {filteredGroups.map((grp) => (
                    <tr
                      key={grp.id}
                      className={`hover:bg-church-50/50 transition-colors ${
                        !grp.is_active ? 'bg-slate-50/80 opacity-75' : ''
                      }`}
                    >
                      {/* 1. اسم المجموعة */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 shadow-xs border ${
                              grp.is_active
                                ? 'bg-church-100 text-church-900 border-church-300'
                                : 'bg-slate-200 text-slate-600 border-slate-300'
                            }`}
                          >
                            <FolderKanban size={20} />
                          </div>
                          <div>
                            <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                              <span>{grp.name}</span>
                              {!grp.is_active && (
                                <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                                  متوقفة
                                </span>
                              )}
                            </div>
                            {grp.description && (
                              <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs truncate">
                                {grp.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. المراحل المتاحة لها */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {grp.stages.length === 0 ? (
                            <span className="text-slate-400 text-[11px] italic">
                              لا توجد مراحل محددة
                            </span>
                          ) : (
                            grp.stages.map((stg) => (
                              <span
                                key={stg.id}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black border shadow-xs ${getStageBadgeStyle(
                                  stg.name
                                )}`}
                              >
                                <span>{getStageIcon(stg.name)}</span>
                                <span>{stg.name}</span>
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      {/* 3. عدد الخدام */}
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleOpenServantsModal(grp)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-extrabold transition-all group active:scale-95"
                          title="عرض وتعديل خدام هذه المجموعة"
                        >
                          <Users size={14} className="text-purple-600" />
                          <span>{grp.servants_count} خادم</span>
                        </button>
                      </td>

                      {/* 4. عدد المخدومين */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-900 border border-blue-200 font-black">
                          <span>{grp.children_count} مخدوم</span>
                        </span>
                      </td>

                      {/* 5. حالة المجموعة */}
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleToggleGroupActive(grp)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black transition-all ${
                            grp.is_active
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-300'
                          }`}
                          title={grp.is_active ? 'إيقاف المجموعة' : 'تفعيل المجموعة'}
                        >
                          {grp.is_active ? (
                            <>
                              <CheckCircle2 size={13} />
                              <span>نشطة</span>
                            </>
                          ) : (
                            <>
                              <XCircle size={13} />
                              <span>متوقفة</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* 6. أزرار التعديل والتفعيل والإيقاف */}
                      <td className="py-4 px-4 sm:px-6 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* تعديل */}
                          <button
                            onClick={() => handleOpenEditModal(grp)}
                            className="p-2 rounded-xl bg-church-50 hover:bg-church-100 text-church-800 border border-church-200 font-bold transition-all"
                            title="تعديل اسم ومراحل المجموعة"
                          >
                            <Edit2 size={14} />
                          </button>

                          {/* تفعيل / إيقاف سريع */}
                          <button
                            onClick={() => handleToggleGroupActive(grp)}
                            className={`p-2 rounded-xl border transition-all ${
                              grp.is_active
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                            }`}
                            title={grp.is_active ? 'إيقاف المجموعة' : 'تفعيل المجموعة'}
                          >
                            <Power size={14} />
                          </button>

                          {/* حذف المجموعة */}
                          <button
                            onClick={() => handleDeleteGroup(grp)}
                            className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-all"
                            title="حذف المجموعة"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: STAGES OVERVIEW (المراحل الثلاث الأساسية)          */}
      {/* ======================================================== */}
      {activeTab === 'stages' && (
        <div className="space-y-6">
          <div className="bg-amber-50/80 border border-amber-200 rounded-3xl p-5 text-amber-950 text-xs flex items-start gap-3">
            <Sparkles size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-sm mb-1">
                المراحل الدراسية الثلاث الأساسية للخدمة:
              </p>
              <p className="leading-relaxed text-amber-900">
                يوفر النظام المراحل الأساسية الثلاث (ابتدائي، إعدادي، ثانوي). يستطيع الأدمن إنشاء أي مجموعة وربطها بمرحلة واحدة أو عدة مراحل معاً لعزل الصلاحيات تلقائياً على مستوى قاعدة البيانات.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stages.map((stg) => {
              const stageKidsCount = allChildren.filter(
                (c) => c.stage_id === stg.id && c.is_active !== false
              ).length;
              const groupsUsingStage = groups.filter((g) => g.stage_ids.includes(stg.id));

              return (
                <div
                  key={stg.id}
                  className="bg-white rounded-3xl p-6 border-2 border-church-200 shadow-sm hover:border-church-400 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-3xl">{getStageIcon(stg.name)}</span>
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full ${
                          stg.is_active
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {stg.is_active ? 'نشطة' : 'متوقفة'}
                      </span>
                    </div>

                    <h3 className="text-xl font-black text-slate-900 mb-1">{stg.name}</h3>
                    <p className="text-xs text-slate-500 font-semibold mb-4">
                      الترتيب بالنظام: #{stg.sort_order}
                    </p>

                    <div className="space-y-2 pt-3 border-t border-church-100 text-xs">
                      <div className="flex justify-between items-center text-slate-600 font-medium">
                        <span>إجمالي المخدومين بالمرحلة:</span>
                        <span className="font-black text-slate-900">{stageKidsCount} مخدوم</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600 font-medium">
                        <span>المجموعات المصرح لها:</span>
                        <span className="font-black text-church-800">
                          {groupsUsingStage.length} مجموعة
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* List of groups having this stage */}
                  <div className="mt-5 pt-3 border-t border-church-100">
                    <div className="text-[11px] font-bold text-slate-500 mb-2">المجموعات المرتبطة:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {groupsUsingStage.length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic">لا توجد مجموعات</span>
                      ) : (
                        groupsUsingStage.map((g) => (
                          <span
                            key={g.id}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-church-50 text-church-900 border border-church-200"
                          >
                            {g.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: CREATE / EDIT GROUP                             */}
      {/* ======================================================== */}
      {groupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-church-200 shadow-2xl p-6 sm:p-7 space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-church-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-church-100 text-church-800 flex items-center justify-center">
                  <FolderKanban size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {editingGroup ? 'تعديل إعدادات المجموعة' : 'إنشاء مجموعة خدمة جديدة'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    حدد اسم المجموعة والمراحل التي يُسمح لها بالوصول إليها
                  </p>
                </div>
              </div>
              <button
                onClick={() => setGroupModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveGroup} className="space-y-5">
              {/* اسم المجموعة */}
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  اسم المجموعة <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مجموعة ابتدائي، مجموعة إعدادي، مجموعة إعدادي وثانوي..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-church-50/50 rounded-2xl border border-church-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-church-500/30 font-bold"
                />
              </div>

              {/* وصف المجموعة */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الوصف أو ملاحظات (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="ملاحظات توضيحية لخدام المجموعة..."
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  className="w-full px-4 py-2 bg-church-50/50 rounded-2xl border border-church-200 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-church-500/30"
                />
              </div>

              {/* اختيار المراحل المتاحة للمجموعة (مرونة تامة) */}
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1">
                  المراحل المتاحة للمجموعة <span className="text-rose-500">*</span>
                </label>
                <p className="text-[11px] text-slate-500 mb-2.5">
                  اختر مرحلة واحدة أو أكثر. لن يتمكن خدام هذه المجموعة من رؤية أي مخدومين أو نقاط خارج هذه المراحل.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {stages.map((stg) => {
                    const isSelected = selectedStageIds.includes(stg.id);
                    return (
                      <div
                        key={stg.id}
                        onClick={() => toggleStageSelection(stg.id)}
                        className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 text-center ${
                          isSelected
                            ? 'bg-church-600 text-white border-church-700 shadow-md scale-[1.02]'
                            : 'bg-white hover:bg-church-50 text-slate-800 border-church-200 hover:border-church-300'
                        }`}
                      >
                        <span className="text-2xl">{getStageIcon(stg.name)}</span>
                        <span className="font-black text-xs">{stg.name}</span>
                        {isSelected && (
                          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <Check size={10} /> مصرح بها
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* حالة التفعيل */}
              <div className="pt-2 border-t border-church-100 flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-slate-800">تفعيل المجموعة</div>
                  <div className="text-[11px] text-slate-500">
                    عند إيقاف المجموعة يتم حجب صلاحياتها فوراً دون حذف أي بيانات
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupIsActive}
                    onChange={(e) => setGroupIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* أزرار الحفظ والإلغاء */}
              <div className="pt-4 border-t border-church-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setGroupModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl border border-church-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-2xl bg-church-600 hover:bg-church-700 text-white font-black text-xs shadow-md transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {submitting ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  <span>{editingGroup ? 'حفظ التعديلات' : 'إنشاء المجموعة'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: MANAGE SERVANTS IN A GROUP                      */}
      {/* ======================================================== */}
      {servantsModalOpen && activeGroupForServants && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-church-200 shadow-2xl p-6 sm:p-7 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-church-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Users className="text-church-600" />
                  <span>خدام: {activeGroupForServants.name}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  حدد الخدام الذين يُسمح لهم بالوصول إلى بيانات هذه المجموعة
                </p>
              </div>
              <button
                onClick={() => setServantsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Search servants */}
            <div className="relative">
              <Search
                size={16}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="ابحث عن خادم بالاسم أو الإيميل..."
                value={servantsSearch}
                onChange={(e) => setServantsSearch(e.target.value)}
                className="w-full pr-9 pl-4 py-2 bg-church-50/50 rounded-2xl border border-church-200 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-church-500/30"
              />
            </div>

            {/* Servants multi-select list */}
            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 divide-y divide-church-50">
              {allServants.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  لا يوجد خدام معتمدين حالياً بالنظام
                </div>
              ) : (
                allServants
                  .filter((s) => {
                    if (!servantsSearch.trim()) return true;
                    const q = servantsSearch.toLowerCase();
                    return (
                      s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
                    );
                  })
                  .map((servant) => {
                    const isSelected = selectedServantIds.includes(servant.id);
                    return (
                      <div
                        key={servant.id}
                        onClick={() => toggleServantSelection(servant.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-church-50/90 border-church-500 ring-1 ring-church-500/20'
                            : 'bg-white hover:bg-slate-50 border-church-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                              isSelected
                                ? 'bg-church-600 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {servant.full_name.charAt(0) || 'خ'}
                          </div>
                          <div>
                            <div className="font-extrabold text-xs text-slate-900">
                              {servant.full_name}
                            </div>
                            <div className="text-[10px] text-slate-500">{servant.email}</div>
                          </div>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-church-600 border-church-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check size={12} />}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="pt-3 border-t border-church-100 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500">
                المعينين: {selectedServantIds.length} خادم
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setServantsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-church-200 text-slate-700 font-bold hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveGroupServants}
                  disabled={savingServants}
                  className="px-4 py-2 rounded-xl bg-church-600 hover:bg-church-700 text-white font-black shadow-md flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  {savingServants ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  <span>حفظ الخدام</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
