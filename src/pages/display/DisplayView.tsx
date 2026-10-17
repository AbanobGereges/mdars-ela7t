import React from 'react';
import { useRealtimePoints } from '../../hooks/useRealtimePoints';
import { Navbar } from '../../components/layout/Navbar';
import { HeroPodium } from '../../components/display/HeroPodium';
import { FamilyPodium } from '../../components/display/FamilyPodium';
import { LiveTicker } from '../../components/display/LiveTicker';
import { supabase } from '../../lib/supabase';
import { Group, Stage } from '../../types/database';
import { Sparkles, Trophy, Pin, Repeat } from 'lucide-react';

export const DisplayView: React.FC = () => {
  const {
    children,
    allFamiliesToday,
    top3ChildrenToday,
    top3FamiliesToday,
    recentLogs,
    loading,
    error,
    refreshData,
  } = useRealtimePoints();

  const [stages, setStages] = React.useState<Stage[]>([]);
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [groupStages, setGroupStages] = React.useState<Array<{ group_id: string; stage_id: string }>>([]);
  
  // Persistent screen filter: 'all' | 'group:<groupId>' | 'stage:<stageId>'
  const [selectedFilter, setSelectedFilter] = React.useState<string>(() => {
    return localStorage.getItem('CHURCH_DISPLAY_FILTER') || 'all';
  });

  const [isSlideshowActive, setIsSlideshowActive] = React.useState<boolean>(false);
  const [slideshowCountdown, setSlideshowCountdown] = React.useState<number>(15);

  React.useEffect(() => {
    // Load active stages and groups
    Promise.all([
      supabase.from('stages').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('groups').select('*').eq('is_active', true).order('name'),
      supabase.from('group_stages').select('group_id, stage_id'),
    ]).then(([stgRes, grpRes, gsRes]) => {
      if (stgRes.data) setStages(stgRes.data as Stage[]);
      if (grpRes.data) setGroups(grpRes.data as Group[]);
      if (gsRes.data) setGroupStages(gsRes.data);
    });
  }, []);

  // Compute allowed stage IDs based on selected filter
  const { allowedStageIds, currentGroup, currentStage, filterTitle, filterSubtitle } = React.useMemo(() => {
    if (!selectedFilter || selectedFilter === 'all') {
      return {
        allowedStageIds: null as string[] | null,
        currentGroup: null,
        currentStage: null,
        filterTitle: 'الترتيب العام — كافة المراحل والأسر',
        filterSubtitle: 'عرض شامل لكافة المراحل والمجموعات في الخدمة',
      };
    }

    if (selectedFilter.startsWith('group:')) {
      const gId = selectedFilter.split(':')[1];
      const grp = groups.find((g) => g.id === gId);
      const sIds = groupStages.filter((gs) => gs.group_id === gId).map((gs) => gs.stage_id);
      const linkedStages = stages.filter((s) => sIds.includes(s.id));
      const stagesText = linkedStages.map((s) => s.name).join(' • ') || 'بدون مراحل';

      return {
        allowedStageIds: sIds,
        currentGroup: grp,
        currentStage: null,
        filterTitle: grp ? `🏆 أبطال ${grp.name}` : 'الترتيب العام',
        filterSubtitle: grp ? `✨ شاشة مستقلة لمجموعة: ${grp.name} (${stagesText}) — معزولة تماماً ✨` : '',
      };
    }

    if (selectedFilter.startsWith('stage:')) {
      const sId = selectedFilter.split(':')[1];
      const stg = stages.find((s) => s.id === sId);
      return {
        allowedStageIds: [sId],
        currentGroup: null,
        currentStage: stg,
        filterTitle: stg ? `🏆 أبطال مرحلة ${stg.name}` : 'الترتيب العام',
        filterSubtitle: stg ? `✨ شاشة مخصصة لمرحلة: ${stg.name} فقط ✨` : '',
      };
    }

    return {
      allowedStageIds: null,
      currentGroup: null,
      currentStage: null,
      filterTitle: 'الترتيب العام',
      filterSubtitle: '',
    };
  }, [selectedFilter, groups, stages, groupStages]);

  // Slideshow effect
  React.useEffect(() => {
    if (!isSlideshowActive || groups.length === 0) return;

    const countdownInterval = setInterval(() => {
      setSlideshowCountdown((prev) => (prev <= 1 ? 15 : prev - 1));
    }, 1000);

    const rotationInterval = setInterval(() => {
      setSelectedFilter((prev) => {
        const currentGid = prev.startsWith('group:') ? prev.split(':')[1] : null;
        const currentIdx = groups.findIndex((g) => g.id === currentGid);
        const nextIdx = (currentIdx + 1) % groups.length;
        return `group:${groups[nextIdx].id}`;
      });
      setSlideshowCountdown(15);
    }, 15000);

    return () => {
      clearInterval(countdownInterval);
      clearInterval(rotationInterval);
    };
  }, [isSlideshowActive, groups]);

  const handleSelectFilter = (filterKey: string) => {
    if (isSlideshowActive) setIsSlideshowActive(false);
    setSelectedFilter(filterKey);
    localStorage.setItem('CHURCH_DISPLAY_FILTER', filterKey);
  };

  const handleLockScreen = () => {
    localStorage.setItem('CHURCH_DISPLAY_FILTER', selectedFilter);
    alert('✓ تم تثبيت هذه المجموعة كافتراضي على هذا الجهاز/المتصفح بنجاح!');
  };

  // Compute strictly isolated Top 3 Children
  const displayedChildrenTop3 = React.useMemo(() => {
    let pool = children;
    if (allowedStageIds && allowedStageIds.length > 0) {
      pool = children.filter((c) => c.child.stage_id && allowedStageIds.includes(c.child.stage_id));
    }
    // Only crown children who actually have points today (> 0)
    const withPoints = pool.filter((c) => c.pointsToday > 0);
    return withPoints.slice(0, 3).map((hero) => ({
      ...hero,
      tiedChildren: withPoints.filter(
        (c) => c.child.id !== hero.child.id && c.pointsToday === hero.pointsToday
      ),
    }));
  }, [children, allowedStageIds]);

  // Compute strictly isolated Top 3 Families
  const displayedFamiliesTop3 = React.useMemo(() => {
    let pool = allFamiliesToday;
    if (allowedStageIds && allowedStageIds.length > 0) {
      pool = allFamiliesToday.filter((f) => f.family.stage_id && allowedStageIds.includes(f.family.stage_id));
    }
    const withPoints = pool.filter((f) => f.pointsToday > 0);
    return withPoints.length > 0 ? withPoints.slice(0, 3) : pool.slice(0, 3);
  }, [allFamiliesToday, allowedStageIds]);

  // Strictly isolated recent logs for ticker
  const displayedLogs = React.useMemo(() => {
    if (!allowedStageIds || allowedStageIds.length === 0) return recentLogs;
    return recentLogs.filter((l) => l.stage_id && allowedStageIds.includes(l.stage_id));
  }, [recentLogs, allowedStageIds]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-church-950 to-black text-white flex flex-col justify-between selection:bg-yellow-500/30">
      {/* Header */}
      <Navbar isDisplayMode={true} />

      {/* Control Bar: Full Group & Stage Controls */}
      <div className="w-full bg-slate-900/90 border-b border-church-500/30 px-4 sm:px-6 py-2.5 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="text-xs font-black text-amber-300 flex items-center gap-1 ml-1">
            <span>🖥️</span>
            <span>تخصيص الشاشة:</span>
          </span>

          <button
            onClick={() => handleSelectFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${
              selectedFilter === 'all'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30 scale-105 border-amber-300 ring-2 ring-amber-300/40'
                : 'bg-white/10 text-white/80 hover:bg-white/20 border-white/10'
            }`}
          >
            🌟 عام (كافة المراحل)
          </button>

          {groups.map((grp) => {
            const isSelected = selectedFilter === `group:${grp.id}`;
            return (
              <button
                key={grp.id}
                onClick={() => handleSelectFilter(`group:${grp.id}`)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30 scale-105 border-amber-300 ring-2 ring-amber-300/40'
                    : 'bg-church-900/90 text-amber-100 hover:bg-church-800 border-church-500/40'
                }`}
              >
                <span>📁</span>
                <span>{grp.name}</span>
              </button>
            );
          })}

          {stages.map((stg) => {
            const isSelected = selectedFilter === `stage:${stg.id}`;
            return (
              <button
                key={stg.id}
                onClick={() => handleSelectFilter(`stage:${stg.id}`)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 border ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 shadow-sm scale-105 border-amber-300 ring-2 ring-amber-300/40'
                    : 'bg-black/50 text-slate-300 hover:bg-white/10 border-white/10'
                }`}
              >
                <span>{stg.name.includes('إعدادي') ? '📖' : stg.name.includes('ثانوي') ? '🎓' : '🎒'}</span>
                <span>{stg.name}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSlideshowActive(!isSlideshowActive)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
              isSlideshowActive
                ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-black ring-2 ring-emerald-300/50 animate-pulse'
                : 'bg-white/10 text-white/90 hover:bg-white/20 border-white/15'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>{isSlideshowActive ? `تبديل تلقائي يعمل (${slideshowCountdown}s)` : 'تشغيل التبديل التلقائي (Slideshow)'}</span>
          </button>

          <button
            onClick={handleLockScreen}
            title="تثبيت هذه المجموعة كافتراضي على هذا الجهاز/الشاشة"
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center gap-1"
          >
            <Pin className="w-3.5 h-3.5" />
            <span>تثبيت للشاشة</span>
          </button>
        </div>
      </div>

      {/* Main Presentation Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col justify-center gap-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 border-4 border-church-500/30 border-t-yellow-400 rounded-full animate-spin"></div>
            <p className="text-xl font-bold text-church-200">جاري تحميل بيانات الأبطال والترتيب...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-950/50 border border-rose-700/60 rounded-3xl p-8 text-center max-w-lg mx-auto">
            <p className="text-rose-200 text-lg font-bold">{error}</p>
            <button
              onClick={() => refreshData()}
              className="mt-4 px-6 py-2.5 bg-rose-700 hover:bg-rose-600 text-white rounded-xl font-bold transition-all"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : (
          <>
            {/* Header Title with Custom Group/Stage Banner */}
            <div className="text-center">
              <div className="inline-block bg-gradient-to-r from-yellow-500/20 via-amber-500/30 to-yellow-500/20 border border-yellow-400/50 text-yellow-300 px-6 py-2 rounded-full text-xs md:text-sm font-black shadow-xl mb-3 backdrop-blur-md">
                {filterSubtitle}
              </div>
              <h2 className="text-3xl md:text-6xl font-black bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent mb-6 tracking-wide drop-shadow-md">
                {filterTitle}
              </h2>
            </div>

            {/* Section 1: 🏆 أبطال اليوم */}
            <section className="animate-in fade-in zoom-in-95 duration-500">
              <HeroPodium top3={displayedChildrenTop3} />
            </section>

            {/* Section 2: 🏠 أبطال الأسر */}
            <section className="pt-4 border-t border-church-800/40 animate-in fade-in slide-in-from-bottom-6 duration-500">
              <div className="text-center mb-6">
                <h3 className="text-2xl md:text-3xl font-black text-white">
                  🏠 أبطال الأسر {currentGroup ? `(${currentGroup.name})` : currentStage ? `(${currentStage.name})` : ''} 🏠
                </h3>
                <p className="text-xs text-church-200/70 mt-1">مجموع نقاط أطفال كل أسرة المسجلة خلال اليوم لهذه المجموعة فقط</p>
              </div>
              <FamilyPodium top3Families={displayedFamiliesTop3} />
            </section>
          </>
        )}
      </main>

      {/* Footer / Live Ticker */}
      <footer className="w-full">
        <LiveTicker logs={displayedLogs} />
      </footer>
    </div>
  );
};
