import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtimePoints } from '../../hooks/useRealtimePoints';
import { supabase } from '../../lib/supabase';
import { PointRule, Child, ChildLeaderboardEntry, Family } from '../../types/database';
import { ChildCard } from '../../components/servant/ChildCard';
import { QuickPointsModal } from '../../components/servant/QuickPointsModal';
import { Users, Search, Home, AlertTriangle, Sparkles, Filter } from 'lucide-react';

export const ServantHome: React.FC = () => {
  const { user, profile, assignedFamilies, role } = useAuth();
  const { children, refreshData, loading: pointsLoading } = useRealtimePoints();

  const [rules, setRules] = useState<PointRule[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeChildForPoints, setActiveChildForPoints] = useState<ChildLeaderboardEntry | null>(null);

  // Fetch point rules & servant families
  useEffect(() => {
    const fetchMetadata = async () => {
      const [rulesRes, famsRes] = await Promise.all([
        supabase.from('point_rules').select('*').order('points', { ascending: false }),
        supabase.from('families').select('*, stage:stages(*)').order('name'),
      ]);

      if (rulesRes.data) setRules(rulesRes.data as PointRule[]);
      if (famsRes.data) {
        // If servant, filter to assigned families
        if (role === 'servant') {
          const permitted = (famsRes.data as Family[]).filter((f) =>
            assignedFamilies.includes(f.id)
          );
          setFamilies(permitted);
        } else {
          setFamilies(famsRes.data as Family[]);
        }
      }
    };

    fetchMetadata();
  }, [assignedFamilies, role]);

  // Filter children based on assigned families + selected family tab + search query
  const filteredChildren = children.filter((entry) => {
    const child = entry.child;

    // Servant access control: must be in assigned families (unless admin)
    if (role === 'servant' && !assignedFamilies.includes(child.family_id)) {
      return false;
    }

    // Tab filter
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

  if (role === 'servant' && assignedFamilies.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-4 border border-amber-300">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-2xl font-black text-slate-800">لم يتم تخصيص أسر لك بعد</h2>
        <p className="text-slate-600 mt-2 text-sm max-w-md mx-auto leading-relaxed">
          أهلاً بك يا خادم المسيح ({profile?.full_name}). يرجى التواصل مع مسؤول الخدمة (الأدمن) لتعيين الأسر المسموح لك بإدارتها لتتمكن من إضافة النقاط لأولادك.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Banner / Servant Welcome */}
      <div className="bg-gradient-to-r from-church-700 via-church-600 to-church-800 rounded-3xl p-6 text-white shadow-lg mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-xs font-bold text-yellow-200 mb-2">
            <Sparkles size={14} />
            لوحة الخادم التفاعلية
          </span>
          <h1 className="text-2xl font-black">أهلاً بك، {profile?.full_name || 'خادم الخدمة'}</h1>
          <p className="text-xs text-church-200 font-medium mt-1">
            اختر المخدوم لتسجيل النقاط (الحضور، الإجابة، السلوك، التسميع...)
          </p>
        </div>

        {/* Total active kids count in assigned families */}
        <div className="bg-black/30 backdrop-blur-md rounded-2xl px-5 py-3 border border-church-500/40 text-center sm:text-right">
          <div className="text-xs text-church-200">إجمالي أولاد أسر الخدمة</div>
          <div className="text-2xl font-black text-yellow-300">{filteredChildren.length} مخدوم</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-4 border border-church-200 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Families Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
          <button
            onClick={() => setSelectedFamilyId('all')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
              selectedFamilyId === 'all'
                ? 'bg-church-600 text-white shadow'
                : 'bg-church-50 text-church-900 hover:bg-church-100'
            }`}
          >
            <Users size={14} />
            كل الأسر المصرح بها ({families.length})
          </button>
          {families.map((fam) => (
            <button
              key={fam.id}
              onClick={() => setSelectedFamilyId(fam.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
                selectedFamilyId === fam.id
                  ? 'bg-church-600 text-white shadow'
                  : 'bg-church-50 text-church-900 hover:bg-church-100'
              }`}
            >
              <Home size={14} />
              {fam.name}
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

      {/* Children Grid */}
      {pointsLoading ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 border-4 border-church-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm font-bold text-church-900">جاري تحميل بيانات المخدومين...</p>
        </div>
      ) : filteredChildren.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-church-200">
          <Users size={48} className="text-church-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">لا يوجد أولاد مطابقين</h3>
          <p className="text-xs text-slate-500 mt-1">تأكد من اختيار الأسرة الصحيحة أو مسح نص البحث</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredChildren.map((entry) => (
            <ChildCard
              key={entry.child.id}
              entry={entry}
              onOpenPointsModal={() => setActiveChildForPoints(entry)}
            />
          ))}
        </div>
      )}

      {/* Points Action Modal */}
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
    </div>
  );
};
