import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Profile, UserRole, Family, FamilyServant } from '../../types/database';
import {
  UserCheck,
  Shield,
  Home,
  CheckCircle,
  XCircle,
  Edit2,
  Search,
  UserX,
  Sparkles,
  Users,
  AlertCircle
} from 'lucide-react';

export const UsersManager: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [familyServants, setFamilyServants] = useState<FamilyServant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Modal states
  const [selectedServantForFamilies, setSelectedServantForFamilies] = useState<Profile | null>(null);
  const [assignedFamIds, setAssignedFamIds] = useState<string[]>([]);
  const [savingFamilies, setSavingFamilies] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchUsersData = async () => {
    setLoading(true);
    try {
      const [profRes, famRes, fsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('families').select('*, stage:stages(*)').order('name'),
        supabase.from('family_servants').select('*'),
      ]);

      if (profRes.data) setProfiles(profRes.data as Profile[]);
      if (famRes.data) setFamilies(famRes.data as Family[]);
      if (fsRes.data) setFamilyServants(fsRes.data as FamilyServant[]);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersData();
  }, []);

  const handleUpdateRole = async (profileId: string, newRole: UserRole) => {
    setActionError(null);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', profileId);

      if (error) throw error;
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, role: newRole } : p))
      );
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'فشل تغيير الدور');
    }
  };

  const handleToggleApproval = async (profile: Profile) => {
    setActionError(null);
    try {
      const nextState = !profile.is_approved;
      if (nextState) {
        // Call the approve_user RPC which confirms email in auth.users AND marks is_approved = true
        const { error: rpcError } = await supabase.rpc('approve_user', {
          target_user_id: profile.id,
        });

        if (rpcError) {
          console.warn('RPC approve_user fallback note:', rpcError);
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ is_approved: true, updated_at: new Date().toISOString() })
            .eq('id', profile.id);
          if (updateError) throw updateError;
        }
      } else {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ is_approved: false, updated_at: new Date().toISOString() })
          .eq('id', profile.id);
        if (updateError) throw updateError;
      }

      setProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, is_approved: nextState } : p))
      );
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'فشل تحديث حالة الاعتماد');
    }
  };

  const openFamilyAssignmentModal = (servant: Profile) => {
    const currentAssigned = familyServants
      .filter((fs) => fs.servant_id === servant.id)
      .map((fs) => fs.family_id);
    setSelectedServantForFamilies(servant);
    setAssignedFamIds(currentAssigned);
  };

  const handleSaveFamilyAssignments = async () => {
    if (!selectedServantForFamilies) return;
    setSavingFamilies(true);
    setActionError(null);

    try {
      // 1. Delete existing assignments for this servant
      await supabase
        .from('family_servants')
        .delete()
        .eq('servant_id', selectedServantForFamilies.id);

      // 2. Insert new assignments
      if (assignedFamIds.length > 0) {
        const rowsToInsert = assignedFamIds.map((fId) => ({
          servant_id: selectedServantForFamilies.id,
          family_id: fId,
        }));
        const { error } = await supabase.from('family_servants').insert(rowsToInsert);
        if (error) throw error;
      }

      await fetchUsersData();
      setSelectedServantForFamilies(null);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'فشل حفظ تخصيص الأسر');
    } finally {
      setSavingFamilies(false);
    }
  };

  const toggleFamilySelection = (familyId: string) => {
    if (assignedFamIds.includes(familyId)) {
      setAssignedFamIds((prev) => prev.filter((id) => id !== familyId));
    } else {
      setAssignedFamIds((prev) => [...prev, familyId]);
    }
  };

  const filteredProfiles = profiles.filter((p) => {
    if (roleFilter !== 'all' && p.role !== roleFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-church-950 flex items-center gap-2">
            <UserCheck className="text-church-600" />
            إدارة المستخدمين والصلاحيات
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            اعتماد الحسابات، تغيير الصلاحيات (Admin / Servant / Display)، وتحديد أسر كل خادم
          </p>
        </div>
      </div>

      {actionError && (
        <div className="mb-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white rounded-3xl p-4 border border-church-200 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Role Filters */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          {[
            { id: 'all', label: 'كل المستخدمين' },
            { id: 'admin', label: '👑 الأدمن' },
            { id: 'servant', label: '🙋 الخدام' },
            { id: 'display', label: '🖥️ شاشات العرض' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRoleFilter(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${
                roleFilter === tab.id
                  ? 'bg-church-600 text-white shadow'
                  : 'bg-church-50 text-church-900 hover:bg-church-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو البريد الإلكتروني..."
            className="w-full text-xs pr-9 pl-4 py-2.5 rounded-xl border border-church-300 focus:outline-none focus:ring-2 focus:ring-church-500 bg-church-50/50"
          />
          <Search size={16} className="absolute right-3 top-3 text-slate-400" />
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="text-center py-16">
          <div className="w-10 h-10 border-4 border-church-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs font-bold text-slate-600">جاري تحميل المستخدمين...</p>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-church-200">
          <UserX size={48} className="text-church-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">لا يوجد مستخدمين مطابقين للبحث</h3>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-church-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-church-50/80 border-b border-church-200 text-church-950 font-black">
                  <th className="py-4 px-6">المستخدم</th>
                  <th className="py-4 px-4">البريد الإلكتروني</th>
                  <th className="py-4 px-4">الصلاحية (Role)</th>
                  <th className="py-4 px-4">الأسر المخصصة</th>
                  <th className="py-4 px-4">حالة الاعتماد</th>
                  <th className="py-4 px-6 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-church-100 font-medium">
                {filteredProfiles.map((p) => {
                  const assignedCount = familyServants.filter((fs) => fs.servant_id === p.id).length;

                  return (
                    <tr key={p.id} className="hover:bg-church-50/40 transition-colors">
                      {/* Name */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-church-100 border border-church-300 flex items-center justify-center font-bold text-church-800">
                            {p.full_name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900">{p.full_name}</div>
                            <div className="text-[10px] text-slate-400">
                              انضم: {new Date(p.created_at).toLocaleDateString('ar-EG')}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-4 px-4 text-slate-600 font-mono text-[11px]">{p.email}</td>

                      {/* Role Selector */}
                      <td className="py-4 px-4">
                        <select
                          value={p.role}
                          onChange={(e) => handleUpdateRole(p.id, e.target.value as UserRole)}
                          className="bg-church-50 border border-church-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-church-500 cursor-pointer"
                        >
                          <option value="admin">👑 Admin (مدير النظام)</option>
                          <option value="servant">🙋 Servant (خادم)</option>
                          <option value="display">🖥️ Display (شاشة عرض)</option>
                        </select>
                      </td>

                      {/* Assigned Families */}
                      <td className="py-4 px-4">
                        {p.role === 'servant' ? (
                          <button
                            onClick={() => openFamilyAssignmentModal(p)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-church-100 hover:bg-church-200 text-church-900 font-bold text-[11px] transition-all border border-church-300"
                          >
                            <Home size={12} />
                            <span>{assignedCount > 0 ? `${assignedCount} أسر مخصصة` : 'تخصيص أسر...'}</span>
                          </button>
                        ) : p.role === 'admin' ? (
                          <span className="text-slate-400 text-[11px]">كل الأسر تلقائياً</span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">شاشة عرض فقط</span>
                        )}
                      </td>

                      {/* Approval Status */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold ${
                            p.is_approved
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {p.is_approved ? <CheckCircle size={12} /> : <XCircle size={12} />}
                          {p.is_approved ? 'معتمد' : 'في الانتظار'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => handleToggleApproval(p)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                            p.is_approved
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                          }`}
                        >
                          {p.is_approved ? 'تعطيل الحساب' : 'اعتماد الآن'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Family Assignment Modal */}
      {selectedServantForFamilies && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-church-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-gradient-to-r from-church-700 to-church-800 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black">تخصيص الأسر للخادم</h3>
                <p className="text-xs text-church-200 mt-0.5 font-medium">
                  {selectedServantForFamilies.full_name} ({selectedServantForFamilies.email})
                </p>
              </div>
              <button
                onClick={() => setSelectedServantForFamilies(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-church-50 border-b border-church-200 text-xs text-slate-600 font-medium">
              حدد الأسر التي يحق لهذا الخادم مشاهدة أطفالها وتسجيل النقاط لهم:
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {families.length === 0 ? (
                <p className="text-center text-slate-400 py-6 text-xs">لا توجد أسر مسجلة في النظام بعد</p>
              ) : (
                families.map((fam) => {
                  const isChecked = assignedFamIds.includes(fam.id);
                  return (
                    <label
                      key={fam.id}
                      onClick={() => toggleFamilySelection(fam.id)}
                      className={`w-full p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-church-100/90 border-church-500 shadow-xs'
                          : 'bg-white hover:bg-church-50/60 border-church-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-church-200 flex items-center justify-center font-bold text-church-800">
                          🏠
                        </div>
                        <div>
                          <div className="font-extrabold text-sm text-slate-900">{fam.name}</div>
                          <div className="text-[11px] text-slate-500">{fam.stage?.name}</div>
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        className="w-5 h-5 rounded-lg text-church-600 border-church-300 focus:ring-church-500 cursor-pointer"
                      />
                    </label>
                  );
                })
              )}
            </div>

            <div className="p-4 bg-church-50 border-t border-church-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedServantForFamilies(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200"
              >
                إلغاء
              </button>
              <button
                disabled={savingFamilies}
                onClick={handleSaveFamilyAssignments}
                className="px-6 py-2 rounded-xl text-xs font-black bg-church-600 hover:bg-church-700 text-white shadow-md transition-all active:scale-95"
              >
                {savingFamilies ? 'جاري الحفظ...' : 'حفظ التخصيص'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
