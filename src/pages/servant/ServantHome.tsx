import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtimePoints } from '../../hooks/useRealtimePoints';
import { supabase } from '../../lib/supabase';
import { PointRule, ChildLeaderboardEntry, Family, Profile, Stage, Group } from '../../types/database';
import { ChildCard } from '../../components/servant/ChildCard';
import { QuickPointsModal } from '../../components/servant/QuickPointsModal';
import { FamilyPointsModal } from '../../components/common/FamilyPointsModal';
import {
  Users,
  Search,
  Home,
  AlertTriangle,
  Sparkles,
  PlusCircle,
  Award,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

export const ServantHome: React.FC = () => {
  const { profile, assignedFamilies, assignedGroups, assignedStages, role, refreshProfile } = useAuth();
  const { children, allFamiliesToday, refreshData, loading: pointsLoading } = useRealtimePoints();

  const [rules, setRules] = useState<PointRule[]>([]);
  const [availableStages, setAvailableStages] = useState<Stage[]>([]);
  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('all');
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeChildForPoints, setActiveChildForPoints] = useState<ChildLeaderboardEntry | null>(null);
  const [familyPointsModalOpen, setFamilyPointsModalOpen] = useState<boolean>(false);
  const [targetFamilyForPoints, setTargetFamilyForPoints] = useState<string | null>(null);
  const [refreshingAssignments, setRefreshingAssignments] = useState<boolean>(false);

  // Student accounts & Attendance Stamp states
  const [pendingStudents, setPendingStudents] = useState<Profile[]>([]);
  const [approvingStudentId, setApprovingStudentId] = useState<string | null>(null);
  const [stampNotification, setStampNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPendingStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .eq('is_approved', false);

      if (!error && data) {
        if (role === 'servant' && assignedStages.length > 0) {
          const relevant = (data as Profile[]).filter(
            (p) =>
              (p.stage_id && assignedStages.includes(p.stage_id)) ||
              (p.family_id && assignedFamilies.includes(p.family_id)) ||
              (!p.stage_id && !p.family_id)
          );
          setPendingStudents(relevant);
        } else {
          setPendingStudents(data as Profile[]);
        }
      }
    } catch (err) {
      console.warn('Error fetching pending students:', err);
    }
  };

  // Fetch point rules, stages, groups, and pending students
  useEffect(() => {
    const fetchMetadata = async () => {
      const [rulesRes, stagesRes, groupsRes] = await Promise.all([
        supabase.from('point_rules').select('*').eq('is_active', true).order('points', { ascending: false }),
        supabase.from('stages').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('groups').select('*').eq('is_active', true),
      ]);
      if (rulesRes.data) setRules(rulesRes.data as PointRule[]);
      if (stagesRes.data) setAvailableStages(stagesRes.data as Stage[]);
      if (groupsRes.data) setAvailableGroups(groupsRes.data as Group[]);
      await fetchPendingStudents();
    };

    fetchMetadata();
  }, [role, assignedStages, assignedFamilies]);

  const handleApproveStudent = async (studentUser: Profile) => {
    setApprovingStudentId(studentUser.id);
    try {
      const { error } = await supabase.rpc('approve_student_account', {
        target_user_id: studentUser.id,
      });
      if (error) {
        console.warn('RPC approve_student_account fallback:', error);
        await supabase.from('profiles').update({ is_approved: true }).eq('id', studentUser.id);
      }
      setPendingStudents((prev) => prev.filter((s) => s.id !== studentUser.id));
      setStampNotification({ type: 'success', text: `✨ تم اعتماد حساب المخدومة (${studentUser.full_name}) بنجاح!` });
    } catch (err: unknown) {
      setStampNotification({
        type: 'error',
        text: err instanceof Error ? err.message : 'فشل اعتماد الحساب',
      });
    } finally {
      setApprovingStudentId(null);
    }
  };

  const handleQuickStampChild = async (childId: string, childName: string) => {
    try {
      const { data, error } = await supabase.rpc('record_student_attendance', {
        target_child_id: childId,
        attendance_method: 'servant_stamp',
      });

      if (error) throw error;
      const res = data as {
        success: boolean;
        message: string;
        already_registered?: boolean;
        is_early?: boolean;
        points_awarded?: number;
        stamp_index?: number;
      };

      if (!res.success && res.already_registered) {
        setStampNotification({
          type: 'error',
          text: `⚠️ ${childName}: ${res.message}`,
        });
      } else {
        setStampNotification({
          type: 'success',
          text: `🌸 ${childName}: ${res.message}`,
        });
        await refreshData();
      }
    } catch (err: unknown) {
      setStampNotification({
        type: 'error',
        text: err instanceof Error ? err.message : 'فشل تسجيل الختم',
      });
    }
  };

  // Names of assigned groups
  const assignedGroupNames = useMemo(() => {
    if (role === 'admin') return ['كل المجموعات (مدير الخدمة)'];
    return availableGroups
      .filter((g) => assignedGroups.includes(g.id))
      .map((g) => g.name);
  }, [availableGroups, assignedGroups, role]);

  // Allowed stages for this servant
  const permittedStagesList = useMemo(() => {
    if (role === 'admin') return availableStages;
    return availableStages.filter((s) => assignedStages.includes(s.id));
  }, [availableStages, assignedStages, role]);

  // Permitted families for this servant (or all for admin)
  const permittedFamilyEntries = useMemo(() => {
    return allFamiliesToday.filter((fe) => {
      if (role === 'admin') return true;
      // Must be in assigned families AND in allowed stages
      const isInAssignedFamilies = assignedFamilies.includes(fe.family.id);
      const isInAllowedStages = assignedStages.includes(fe.family.stage_id);
      return isInAssignedFamilies && isInAllowedStages;
    });
  }, [allFamiliesToday, assignedFamilies, assignedStages, role]);

  const permittedFamilies: Family[] = useMemo(() => {
    return permittedFamilyEntries.map((fe) => fe.family);
  }, [permittedFamilyEntries]);

  // Active family entry if a specific family tab is selected
  const activeFamilyEntry = useMemo(() => {
    if (selectedFamilyId === 'all') return null;
    return permittedFamilyEntries.find((fe) => fe.family.id === selectedFamilyId) || null;
  }, [permittedFamilyEntries, selectedFamilyId]);

  // Filter children based on assigned stages + assigned families + selected stage tab + selected family tab + search query
  const filteredChildren = useMemo(() => {
    return children.filter((entry) => {
      const child = entry.child;

      // Servant access control: must be in assigned stages
      if (role === 'servant') {
        if (assignedStages.length > 0 && !assignedStages.includes(child.stage_id)) {
          return false;
        }
        if (assignedFamilies.length > 0 && !assignedFamilies.includes(child.family_id)) {
          return false;
        }
      }

      // Stage filter pill (if servant has multiple stages)
      if (selectedStageFilter !== 'all' && child.stage_id !== selectedStageFilter) {
        return false;
      }

      // Family Tab filter
      if (selectedFamilyId !== 'all' && child.family_id !== selectedFamilyId) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchName = child.full_name.toLowerCase().includes(query);
        const matchCode = child.code ? child.code.toLowerCase().includes(query) : false;
        return matchName || matchCode;
      }

      return true;
    });
  }, [children, role, assignedStages, assignedFamilies, selectedStageFilter, selectedFamilyId, searchQuery]);

  // Handle manual refresh of assignments
  const handleRefreshAssignments = async () => {
    setRefreshingAssignments(true);
    await refreshProfile();
    await refreshData();
    await fetchPendingStudents();
    setRefreshingAssignments(false);
  };

  const handleOpenFamilyPointsModal = (famId?: string) => {
    setTargetFamilyForPoints(famId || (selectedFamilyId !== 'all' ? selectedFamilyId : null));
    setFamilyPointsModalOpen(true);
  };

  // If servant has no assigned active stages/groups yet
  if (role === 'servant' && assignedStages.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-4 border border-amber-300 shadow-sm">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-2xl font-black text-slate-800">لم يتم إسنادك إلى مجموعة خدمة بعد</h2>
        <p className="text-slate-600 mt-2 text-sm max-w-md mx-auto leading-relaxed">
          أهلاً بك يا خادم المسيح ({profile?.full_name}). يرجى التواصل مع مسؤول الخدمة (الأدمن) لإضافتك إلى إحدى مجموعات الخدمة (ابتدائي / إعدادي / ثانوي) من لوحة الإدارة حتى تتمكن من الوصول إلى أولادك وتسجيل النقاط.
        </p>
        <button
          onClick={handleRefreshAssignments}
          disabled={refreshingAssignments}
          className="mt-6 px-5 py-2.5 rounded-xl bg-church-600 hover:bg-church-700 text-white text-xs font-bold shadow transition-all inline-flex items-center gap-2"
        >
          <RefreshCw size={14} className={refreshingAssignments ? 'animate-spin' : ''} />
          <span>{refreshingAssignments ? 'جاري التحقق...' : 'تحديث تعيينات المجموعات الآن'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner / Servant Welcome */}
      <div className="bg-gradient-to-r from-church-800 via-church-700 to-church-800 rounded-3xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 border border-church-600/40">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 bg-white/20 text-yellow-300 px-3 py-1 rounded-full text-xs font-bold">
              <Sparkles size={14} />
              لوحة الخادم التفاعلية
            </span>
            {assignedGroupNames.length > 0 && (
              <span className="inline-flex items-center gap-1 bg-amber-400/20 text-amber-200 border border-amber-400/30 px-3 py-1 rounded-full text-xs font-bold">
                📁 المجموعة: {assignedGroupNames.join('، ')}
              </span>
            )}
            {permittedStagesList.length > 0 && (
              <span className="inline-flex items-center gap-1 bg-sky-400/20 text-sky-200 border border-sky-400/30 px-3 py-1 rounded-full text-xs font-bold">
                🎓 المراحل المصرح بها: {permittedStagesList.map((s) => s.name).join('، ')}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">أهلاً بك، {profile?.full_name || 'خادم الخدمة'}</h1>
          <p className="text-xs text-church-200 font-medium mt-1">
            سجّل نقاط الأولاد في أسر خدمتك، أو أضف نقاطاً مباشرة للأسرة للتنافس العام اليوم
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Direct Family Points Button */}
          <button
            onClick={() => handleOpenFamilyPointsModal()}
            className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-yellow-950 font-black text-xs shadow-lg transition-all active:scale-95 flex items-center gap-2"
          >
            <PlusCircle size={16} />
            <span>إضافة نقاط للأسرة</span>
          </button>

          {/* Kids Counter Badge */}
          <div className="bg-black/30 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-church-500/40 text-center">
            <div className="text-[10px] text-church-200 font-semibold">أولاد أسر الخدمة</div>
            <div className="text-xl font-black text-yellow-300">{filteredChildren.length} مخدوم</div>
          </div>
        </div>
      </div>

      {/* Stamp Notification Toast */}
      {stampNotification && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 transition-all shadow-sm ${
            stampNotification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{stampNotification.type === 'success' ? '✓' : '⚠️'}</span>
            <span>{stampNotification.text}</span>
          </div>
          <button
            onClick={() => setStampNotification(null)}
            className="text-slate-400 hover:text-slate-700 font-black text-xs px-2 py-1 rounded-lg hover:bg-black/5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Pending Student Registrations Approval Banner */}
      {pendingStudents.length > 0 && (
        <div className="bg-gradient-to-r from-pink-50 via-rose-50 to-pink-50 border-2 border-pink-300 rounded-3xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🌸</span>
              <h3 className="text-sm font-black text-rose-950">
                مخدومي إعدادي بانتظار الاعتماد لتفعيل كارت الأختام ({pendingStudents.length})
              </h3>
            </div>
            <span className="text-[11px] font-bold text-rose-700 bg-white/90 px-3 py-1 rounded-full border border-pink-200 self-start sm:self-auto">
              متاح الاعتماد لخادم المرحلة أو الأدمن
            </span>
          </div>

          <p className="text-xs text-rose-900/80 mb-4 font-medium">
            سجلت هؤلاء البنات بالبريد الإلكتروني ويحتاجون لاعتماد خادم المرحلة لتفعيل حساباتهن وكارت الأختام الأربعة:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingStudents.map((stu) => (
              <div
                key={stu.id}
                className="bg-white rounded-2xl p-4 border border-pink-200 shadow-xs flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-black text-slate-900 text-xs">{stu.full_name}</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">{stu.email}</div>
                  {stu.family_id && (
                    <div className="text-[10px] text-pink-700 font-bold mt-1">
                      أسرة: {permittedFamilies.find((f) => f.id === stu.family_id)?.name || 'الأسرة'}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleApproveStudent(stu)}
                  disabled={approvingStudentId === stu.id}
                  className="px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-black text-xs shadow-xs transition-all active:scale-95 shrink-0 flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  <span>{approvingStudentId === stu.id ? 'جاري...' : 'اعتماد'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stage Filter if Servant has access to multiple stages */}
      {permittedStagesList.length > 1 && (
        <div className="bg-white p-3.5 rounded-2xl border border-church-200/90 shadow-xs flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-bold text-slate-500 shrink-0 ml-1">تصفية حسب المرحلة:</span>
          <button
            onClick={() => setSelectedStageFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
              selectedStageFilter === 'all'
                ? 'bg-church-600 text-white shadow-xs'
                : 'bg-church-50 text-church-900 hover:bg-church-100'
            }`}
          >
            جميع المراحل المتاحة ({permittedStagesList.length})
          </button>
          {permittedStagesList.map((stg) => (
            <button
              key={stg.id}
              onClick={() => setSelectedStageFilter(stg.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                selectedStageFilter === stg.id
                  ? 'bg-church-600 text-white shadow-xs'
                  : 'bg-church-50 text-church-900 hover:bg-church-100'
              }`}
            >
              {stg.name}
            </button>
          ))}
        </div>
      )}

      {/* Families Overview & Points Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {permittedFamilyEntries.map((fe) => {
          const isSelected = selectedFamilyId === fe.family.id;
          const kidsPts = fe.childrenPointsToday || 0;
          const directPts = fe.directPointsToday || 0;
          const totalPts = fe.pointsToday || 0;

          return (
            <div
              key={fe.family.id}
              onClick={() => setSelectedFamilyId(isSelected ? 'all' : fe.family.id)}
              className={`rounded-3xl p-5 border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-church-50/90 border-church-600 shadow-md ring-2 ring-church-500/20'
                  : 'bg-white border-church-200 shadow-xs hover:border-church-400 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-church-100 text-church-800 flex items-center justify-center font-bold text-base shadow-xs">
                    🏠
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">{fe.family.name}</h3>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {fe.family.stage ? fe.family.stage.name : 'المرحلة'} • {fe.childrenCount} مخدوم
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenFamilyPointsModal(fe.family.id);
                  }}
                  className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition-colors border border-amber-200 flex items-center gap-1 shrink-0"
                  title="إضافة نقاط مباشرة لهذه الأسرة"
                >
                  <PlusCircle size={14} />
                  <span className="hidden sm:inline text-[10px]">نقاط للأسرة</span>
                </button>
              </div>

              {/* Points Breakdown */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-church-100 text-center">
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-500 font-bold">نقاط الأولاد</div>
                  <div className="text-xs font-black text-slate-800 mt-0.5">{kidsPts}</div>
                </div>
                <div className="bg-amber-50/60 p-2 rounded-xl border border-amber-100">
                  <div className="text-[10px] text-amber-700 font-bold">نقاط الأسرة</div>
                  <div className="text-xs font-black text-amber-900 mt-0.5">{directPts > 0 ? `+${directPts}` : directPts}</div>
                </div>
                <div className="bg-emerald-50/80 p-2 rounded-xl border border-emerald-100">
                  <div className="text-[10px] text-emerald-800 font-bold">إجمالي اليوم</div>
                  <div className="text-xs font-black text-emerald-900 mt-0.5">{totalPts}</div>
                </div>
              </div>

              {isSelected && (
                <div className="mt-3 text-center text-[11px] font-bold text-church-700">
                  ✓ يتم عرض أولاد هذه الأسرة بالأسفل
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-4 border border-church-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Families Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
          <button
            onClick={() => setSelectedFamilyId('all')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
              selectedFamilyId === 'all'
                ? 'bg-church-600 text-white shadow'
                : 'bg-church-50 text-church-900 hover:bg-church-100'
            }`}
          >
            <Users size={14} />
            <span>كل الأسر المعيّنة ({permittedFamilies.length})</span>
          </button>
          {permittedFamilies.map((fam) => (
            <button
              key={fam.id}
              onClick={() => setSelectedFamilyId(fam.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
                selectedFamilyId === fam.id
                  ? 'bg-church-600 text-white shadow'
                  : 'bg-church-50 text-church-900 hover:bg-church-100'
              }`}
            >
              <Home size={14} />
              <span>{fam.name}</span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم المخدوم أو الكود..."
            className="w-full text-xs pr-9 pl-4 py-2.5 rounded-xl border border-church-300 focus:outline-none focus:ring-2 focus:ring-church-500 bg-church-50/50"
          />
          <Search size={16} className="absolute right-3 top-3 text-slate-400" />
        </div>
      </div>

      {/* Selected Family Header Summary (if specific family tab is active) */}
      {activeFamilyEntry && (
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-church-300/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-church-100 text-church-800 flex items-center justify-center text-xl shadow-xs">
              🏠
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900">أسرة: {activeFamilyEntry.family.name}</h2>
                <span className="text-xs text-church-700 bg-church-50 border border-church-200 px-2.5 py-0.5 rounded-full font-bold">
                  {activeFamilyEntry.family.stage?.name || 'المرحلة'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                نقاط الأولاد: <strong className="text-slate-800">{activeFamilyEntry.childrenPointsToday || 0}</strong> • 
                نقاط الأسرة المباشرة: <strong className="text-amber-800">{activeFamilyEntry.directPointsToday || 0}</strong> • 
                الإجمالي اليوم: <strong className="text-emerald-700">{activeFamilyEntry.pointsToday || 0} نقطة</strong>
              </p>
            </div>
          </div>

          <button
            onClick={() => handleOpenFamilyPointsModal(activeFamilyEntry.family.id)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-yellow-950 font-black text-xs shadow transition-all flex items-center justify-center gap-1.5"
          >
            <PlusCircle size={16} />
            <span>إضافة نقاط لأسرة ({activeFamilyEntry.family.name})</span>
          </button>
        </div>
      )}

      {/* Children Grid */}
      {pointsLoading ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 border-4 border-church-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm font-bold text-church-900">جاري تحميل بيانات المخدومين...</p>
        </div>
      ) : filteredChildren.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-church-200 shadow-sm">
          <Users size={48} className="text-church-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">لا يوجد أولاد مطابقين في هذه الأسرة</h3>
          <p className="text-xs text-slate-500 mt-1">تأكد من اختيار الأسرة المطلوبة أو مسح نص البحث</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-church-950 flex items-center gap-2">
              <Award size={18} className="text-church-600" />
              <span>أولاد الخدمة ({filteredChildren.length} مخدوم)</span>
            </h3>
            <span className="text-xs text-slate-500">اضغط على أي مخدوم لتسجيل النقاط</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredChildren.map((entry) => (
              <ChildCard
                key={entry.child.id}
                entry={entry}
                onOpenPointsModal={() => setActiveChildForPoints(entry)}
                onQuickStamp={() => handleQuickStampChild(entry.child.id, entry.child.full_name)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Quick Points Modal for Children */}
      {activeChildForPoints && (
        <QuickPointsModal
          child={activeChildForPoints.child}
          rules={rules}
          pointsToday={activeChildForPoints.pointsToday}
          pointsTotal={activeChildForPoints.pointsTotal}
          onClose={() => setActiveChildForPoints(null)}
          onSuccess={() => {
            refreshData();
          }}
        />
      )}

      {/* Direct Family Points Modal */}
      <FamilyPointsModal
        isOpen={familyPointsModalOpen}
        onClose={() => setFamilyPointsModalOpen(false)}
        onSuccess={() => {
          refreshData();
        }}
        families={permittedFamilies}
        preSelectedFamilyId={targetFamilyForPoints}
      />
    </div>
  );
};
