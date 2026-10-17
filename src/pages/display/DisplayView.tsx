import React from 'react';
import { useRealtimePoints } from '../../hooks/useRealtimePoints';
import { Navbar } from '../../components/layout/Navbar';
import { HeroPodium } from '../../components/display/HeroPodium';
import { FamilyPodium } from '../../components/display/FamilyPodium';
import { LiveTicker } from '../../components/display/LiveTicker';
import { supabase } from '../../lib/supabase';
import { Group, Stage, DisplaySettings } from '../../types/database';
import confetti from 'canvas-confetti';

export const DisplayView: React.FC = () => {
  const {
    children,
    allFamiliesToday,
    recentLogs,
    loading,
    error,
    refreshData,
  } = useRealtimePoints();

  const [stages, setStages] = React.useState<Stage[]>([]);
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [groupStages, setGroupStages] = React.useState<Array<{ group_id: string; stage_id: string }>>([]);

  // Active filter dictated solely by Admin: 'all' | 'group:<groupId>' | 'stage:<stageId>'
  const [selectedFilter, setSelectedFilter] = React.useState<string>(() => {
    return localStorage.getItem('CHURCH_DISPLAY_FILTER') || 'all';
  });

  const [isSlideshowActive, setIsSlideshowActive] = React.useState<boolean>(false);
  const [slideshowInterval, setSlideshowInterval] = React.useState<number>(15);
  const [slideshowCountdown, setSlideshowCountdown] = React.useState<number>(15);

  // Load initial stages, groups, and remote display settings from Supabase
  React.useEffect(() => {
    Promise.all([
      supabase.from('stages').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('groups').select('*').eq('is_active', true).order('name'),
      supabase.from('group_stages').select('group_id, stage_id'),
      supabase.from('display_settings').select('*').eq('id', 'current_display_config').maybeSingle(),
    ]).then(([stgRes, grpRes, gsRes, dispRes]) => {
      if (stgRes.data) setStages(stgRes.data as Stage[]);
      if (grpRes.data) setGroups(grpRes.data as Group[]);
      if (gsRes.data) setGroupStages(gsRes.data);

      if (dispRes.data) {
        const config = dispRes.data as DisplaySettings;
        let filterKey = 'all';
        if (config.mode === 'group' && config.target_id) {
          filterKey = `group:${config.target_id}`;
        } else if (config.mode === 'stage' && config.target_id) {
          filterKey = `stage:${config.target_id}`;
        }
        setSelectedFilter(filterKey);
        setIsSlideshowActive(config.slideshow_active || false);
        setSlideshowInterval(config.slideshow_interval_seconds || 15);
        setSlideshowCountdown(config.slideshow_interval_seconds || 15);
        localStorage.setItem('CHURCH_DISPLAY_FILTER', filterKey);
      }
    });
  }, []);

  // Listen to remote commands from Admin via Realtime broadcast, Postgres changes, and BroadcastChannel
  React.useEffect(() => {
    const handleCommand = (payload: any) => {
      if (!payload) return;

      if (payload.action === 'confetti') {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#fbbf24', '#10b981', '#3b82f6', '#ec4899'],
        });
        return;
      }

      if (payload.action === 'set_filter' || payload.filterKey) {
        const fKey = payload.filterKey || 'all';
        setSelectedFilter(fKey);
        localStorage.setItem('CHURCH_DISPLAY_FILTER', fKey);
        if (typeof payload.slideshow === 'boolean') {
          setIsSlideshowActive(payload.slideshow);
        }
        if (typeof payload.intervalSec === 'number') {
          setSlideshowInterval(payload.intervalSec);
          setSlideshowCountdown(payload.intervalSec);
        }
      }
    };

    // 1. Supabase Realtime Channel
    const channel = supabase
      .channel('church-points-realtime-channel')
      .on('broadcast', { event: 'display_command' }, (event) => {
        handleCommand(event.payload);
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'display_settings' },
        (payload) => {
          if (payload.new) {
            const config = payload.new as DisplaySettings;
            let filterKey = 'all';
            if (config.mode === 'group' && config.target_id) {
              filterKey = `group:${config.target_id}`;
            } else if (config.mode === 'stage' && config.target_id) {
              filterKey = `stage:${config.target_id}`;
            }
            setSelectedFilter(filterKey);
            setIsSlideshowActive(config.slideshow_active || false);
            setSlideshowInterval(config.slideshow_interval_seconds || 15);
            setSlideshowCountdown(config.slideshow_interval_seconds || 15);
            localStorage.setItem('CHURCH_DISPLAY_FILTER', filterKey);
          }
        }
      )
      .subscribe();

    // 2. Browser BroadcastChannel
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('church_display_sync');
        bc.onmessage = (e) => {
          handleCommand(e.data);
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }

    // 3. Storage event fallback
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'CHURCH_DISPLAY_FILTER' && e.newValue) {
        setSelectedFilter(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      supabase.removeChannel(channel);
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Compute allowed stage IDs based on Admin's selected filter
  const { allowedStageIds, filterTitle, filterSubtitle } = React.useMemo(() => {
    if (!selectedFilter || selectedFilter === 'all') {
      return {
        allowedStageIds: null as string[] | null,
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
        filterTitle: grp ? `🏆 أبطال ${grp.name}` : 'الترتيب العام',
        filterSubtitle: grp ? `✨ شاشة مستقلة لمجموعة: ${grp.name} (${stagesText}) — معزولة تماماً ✨` : '',
      };
    }

    if (selectedFilter.startsWith('stage:')) {
      const sId = selectedFilter.split(':')[1];
      const stg = stages.find((s) => s.id === sId);
      return {
        allowedStageIds: [sId],
        filterTitle: stg ? `🏆 أبطال مرحلة ${stg.name}` : 'الترتيب العام',
        filterSubtitle: stg ? `✨ شاشة مخصصة لمرحلة: ${stg.name} فقط ✨` : '',
      };
    }

    return {
      allowedStageIds: null,
      filterTitle: 'الترتيب العام',
      filterSubtitle: '',
    };
  }, [selectedFilter, groups, stages, groupStages]);

  // Slideshow rotation if activated remotely by Admin
  React.useEffect(() => {
    if (!isSlideshowActive || groups.length === 0) return;

    const countdownInterval = setInterval(() => {
      setSlideshowCountdown((prev) => (prev <= 1 ? slideshowInterval : prev - 1));
    }, 1000);

    const rotationInterval = setInterval(() => {
      setSelectedFilter((prev) => {
        const currentGid = prev.startsWith('group:') ? prev.split(':')[1] : null;
        const currentIdx = groups.findIndex((g) => g.id === currentGid);
        const nextIdx = (currentIdx + 1) % groups.length;
        return `group:${groups[nextIdx].id}`;
      });
      setSlideshowCountdown(slideshowInterval);
    }, slideshowInterval * 1000);

    return () => {
      clearInterval(countdownInterval);
      clearInterval(rotationInterval);
    };
  }, [isSlideshowActive, groups, slideshowInterval]);

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
      {/* High-Contrast Presentation Header */}
      <Navbar isDisplayMode={true} />

      {/* Remote Broadcast Header Bar (Controlled solely by Admin) */}
      <div className="w-full bg-slate-900/90 border-b border-church-500/30 px-4 sm:px-6 py-2.5 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs z-20">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-full text-xs font-black shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>بث مباشر تحت تحكم الإدارة</span>
          </div>

          <span className="font-black text-amber-300 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/30">
            {filterTitle}
          </span>

          {isSlideshowActive && (
            <span className="text-[11px] text-amber-200 font-bold bg-amber-950/60 px-2.5 py-0.5 rounded-md border border-amber-500/30 flex items-center gap-1">
              <span>🔄 تبديل تلقائي للمجموعات</span>
              <span className="font-mono text-amber-400 font-black">({slideshowCountdown}s)</span>
            </span>
          )}
        </div>

        <div className="text-[11px] text-slate-400 font-semibold hidden sm:flex items-center gap-2">
          <span>🔒 الشاشة مضبوطة تلقائياً من لوحة التحكم</span>
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
              className="mt-4 px-6 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : (
          <>
            {/* Top 3 Children Champions Podium */}
            <section className="space-y-4">
              <div className="text-center">
                <h2 className="text-2xl sm:text-3xl font-black text-yellow-300 drop-shadow-md">
                  👑 {filterTitle} — أبطال اليوم 👑
                </h2>
                {filterSubtitle && (
                  <p className="text-xs sm:text-sm text-church-200 font-semibold mt-1">
                    {filterSubtitle}
                  </p>
                )}
              </div>
              <HeroPodium top3Children={displayedChildrenTop3} />
            </section>

            {/* Top 3 Families Podium */}
            <section className="space-y-4 pt-2">
              <div className="text-center">
                <h3 className="text-xl sm:text-2xl font-black text-church-200 drop-shadow-md">
                  🏰 ترتيب الأسر في اليوم 🏰
                </h3>
              </div>
              <FamilyPodium top3Families={displayedFamiliesTop3} />
            </section>
          </>
        )}
      </main>

      {/* Bottom Realtime Live News Ticker */}
      <footer className="w-full">
        <LiveTicker recentLogs={displayedLogs} />
      </footer>
    </div>
  );
};
