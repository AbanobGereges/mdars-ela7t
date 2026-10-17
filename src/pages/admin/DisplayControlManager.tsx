import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Group, Stage, DisplaySettings } from '../../types/database';
import {
  Tv,
  Sparkles,
  Layers,
  Repeat,
  ExternalLink,
  CheckCircle2,
  Radio,
  Play,
  Square,
  PartyPopper,
  ShieldCheck,
  RefreshCw,
  FolderOpen,
  GraduationCap,
  BookOpen,
  School
} from 'lucide-react';

export const DisplayControlManager: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [groupStages, setGroupStages] = useState<Array<{ group_id: string; stage_id: string }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [broadcasting, setBroadcasting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Current display settings state
  const [currentFilter, setCurrentFilter] = useState<string>(() => {
    return localStorage.getItem('CHURCH_DISPLAY_FILTER') || 'all';
  });
  const [isSlideshowActive, setIsSlideshowActive] = useState<boolean>(false);
  const [slideshowInterval, setSlideshowInterval] = useState<number>(15);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load groups, stages, group_stages, and current display settings from DB
  const loadData = async () => {
    setLoading(true);
    try {
      const [grpRes, stgRes, gsRes, dispRes] = await Promise.all([
        supabase.from('groups').select('*').eq('is_active', true).order('name'),
        supabase.from('stages').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('group_stages').select('group_id, stage_id'),
        supabase.from('display_settings').select('*').eq('id', 'current_display_config').maybeSingle(),
      ]);

      if (grpRes.data) setGroups(grpRes.data as Group[]);
      if (stgRes.data) setStages(stgRes.data as Stage[]);
      if (gsRes.data) setGroupStages(gsRes.data);

      if (dispRes.data) {
        const config = dispRes.data as DisplaySettings;
        let filterKey = 'all';
        if (config.mode === 'group' && config.target_id) {
          filterKey = `group:${config.target_id}`;
        } else if (config.mode === 'stage' && config.target_id) {
          filterKey = `stage:${config.target_id}`;
        }
        setCurrentFilter(filterKey);
        setIsSlideshowActive(config.slideshow_active || false);
        setSlideshowInterval(config.slideshow_interval_seconds || 15);
        localStorage.setItem('CHURCH_DISPLAY_FILTER', filterKey);
      }
    } catch (err) {
      console.error('Error loading display control data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen for realtime changes on display_settings table
    const channel = supabase
      .channel('display-control-manager-channel')
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
            setCurrentFilter(filterKey);
            setIsSlideshowActive(config.slideshow_active);
            setSlideshowInterval(config.slideshow_interval_seconds || 15);
            localStorage.setItem('CHURCH_DISPLAY_FILTER', filterKey);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Centralized broadcast command handler
  const broadcastDisplay = async (
    mode: 'all' | 'group' | 'stage',
    targetId: string | null = null,
    slideshow: boolean = false,
    intervalSec: number = slideshowInterval
  ) => {
    setBroadcasting(true);
    let filterKey = 'all';
    let targetName = 'الترتيب العام (كافة المراحل)';

    if (mode === 'group' && targetId) {
      filterKey = `group:${targetId}`;
      const grp = groups.find((g) => g.id === targetId);
      targetName = grp ? grp.name : 'المجموعة المحددة';
    } else if (mode === 'stage' && targetId) {
      filterKey = `stage:${targetId}`;
      const stg = stages.find((s) => s.id === targetId);
      targetName = stg ? `مرحلة ${stg.name}` : 'المرحلة المحددة';
    }

    setCurrentFilter(filterKey);
    setIsSlideshowActive(slideshow);
    localStorage.setItem('CHURCH_DISPLAY_FILTER', filterKey);

    // 1. Cross-tab Native BroadcastChannel
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('church_display_sync');
        bc.postMessage({
          type: 'set_filter',
          filterKey,
          mode,
          targetId,
          slideshow,
          intervalSec,
        });
        bc.close();
      }
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }

    // 2. Supabase Realtime Broadcast message (instant for TV receivers)
    try {
      const channel = supabase.channel('church-points-realtime-channel');
      await channel.send({
        type: 'broadcast',
        event: 'display_command',
        payload: {
          action: 'set_filter',
          filterKey,
          mode,
          targetId,
          slideshow,
          intervalSec,
        },
      });
    } catch (e) {
      console.warn('Supabase realtime broadcast error:', e);
    }

    // 3. Persistent Supabase DB write
    try {
      await supabase.from('display_settings').upsert({
        id: 'current_display_config',
        mode,
        target_id: targetId,
        slideshow_active: slideshow,
        slideshow_interval_seconds: intervalSec,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Supabase DB display_settings upsert error:', e);
    }

    setBroadcasting(false);
    showToast(`✓ تم بث (${targetName}) بنجاح إلى جميع شاشات العرض!`);
  };

  // Trigger celebration / confetti broadcast on all display screens
  const triggerCelebrationBroadcast = async () => {
    try {
      // Broadcast via Realtime channel
      const channel = supabase.channel('church-points-realtime-channel');
      await channel.send({
        type: 'broadcast',
        event: 'display_command',
        payload: {
          action: 'confetti',
        },
      });

      // Local cross-tab
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('church_display_sync');
        bc.postMessage({ type: 'confetti' });
        bc.close();
      }

      showToast('🎉 تم إطلاق الاحتفال والكونفيتي على جميع شاشات العرض الآن!');
    } catch (e) {
      console.error('Error triggering celebration:', e);
    }
  };

  // Resolve current active title
  const currentActiveName = React.useMemo(() => {
    if (isSlideshowActive) {
      return `🔄 تبديل تلقائي شرائح Slideshow (كل ${slideshowInterval} ثانية)`;
    }
    if (!currentFilter || currentFilter === 'all') {
      return '🌟 الترتيب العام الشامل — كافة المراحل والأسر والأولاد';
    }
    if (currentFilter.startsWith('group:')) {
      const gId = currentFilter.split(':')[1];
      const g = groups.find((grp) => grp.id === gId);
      return g ? `📁 ${g.name} (معزولة تماماً)` : 'مجموعة معينة';
    }
    if (currentFilter.startsWith('stage:')) {
      const sId = currentFilter.split(':')[1];
      const s = stages.find((stg) => stg.id === sId);
      return s ? `🎒 مرحلة ${s.name} فقط` : 'مرحلة معينة';
    }
    return 'الترتيب العام';
  }, [currentFilter, isSlideshowActive, slideshowInterval, groups, stages]);

  const openDisplayWindow = () => {
    window.open(`${window.location.origin}${window.location.pathname}?tab=display`, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-amber-300 border-2 border-amber-400 px-6 py-3 rounded-2xl shadow-2xl font-black text-sm flex items-center gap-2 animate-bounce">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-church-900 to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-church-500/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-amber-400/20 text-amber-300 border border-amber-400/40 px-3 py-1 rounded-full text-xs font-black mb-3">
            <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>غرفة التحكم المركزي في البث المباشر (Display Remote Control)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-wide">
            التحكم في شاشة العرض TV
          </h1>
          <p className="text-sm text-church-200 mt-2 max-w-2xl leading-relaxed">
            التحكم المباشر والمطلق فيما تعرضه شاشات العرض والتلفزيونات داخل الكنيسة. اختيارك هنا يُفرض فوراً على جميع الشاشات المتصلة بدون إمكانية تعديل من شاشة العرض نفسها.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={openDisplayWindow}
            className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-xl transition-all active:scale-95 flex items-center gap-2 border border-amber-300"
          >
            <ExternalLink className="w-4 h-4" />
            <span>فتح شاشة العرض في نافذة جديدة</span>
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-all flex items-center gap-1.5"
            title="تحديث الإعدادات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* Current Live Broadcast Status Card */}
      <div className="bg-white rounded-3xl p-6 border-2 border-amber-400/40 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-inner shrink-0">
              <Tv className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 block mb-1">
                البث المباشر المعروض الآن على الشاشات:
              </span>
              <div className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2 flex-wrap">
                <span>{currentActiveName}</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  مباشر Realtime
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={triggerCelebrationBroadcast}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-2"
            >
              <PartyPopper className="w-4 h-4" />
              <span>🎉 إطلاق احتفال للشاشات</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 1: General Broadcast */}
      <div className="bg-white rounded-3xl p-6 border border-church-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌟</span>
            <h2 className="text-lg font-black text-slate-900">البث العام الشامل</h2>
          </div>
          <span className="text-xs text-slate-500 font-semibold">يشمل كافة المراحل والأسر والأولاد</span>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-slate-900 text-sm">الترتيب العام الشامل لمدارس الأحد</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              يعرض ترتيب أفضل 3 أولاد وأفضل 3 أسر على مستوى الكنيسة بالكامل دون أي تصفية.
            </p>
          </div>
          <button
            onClick={() => broadcastDisplay('all', null, false)}
            disabled={broadcasting}
            className={`px-5 py-3 rounded-xl font-black text-xs transition-all flex items-center gap-2 shrink-0 ${
              currentFilter === 'all' && !isSlideshowActive
                ? 'bg-emerald-600 text-white ring-4 ring-emerald-300/40 shadow-lg'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md active:scale-95'
            }`}
          >
            {currentFilter === 'all' && !isSlideshowActive ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>معروض حالياً على الشاشة ✅</span>
              </>
            ) : (
              <>
                <Radio className="w-4 h-4" />
                <span>بث الترتيب العام فوراً</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Section 2: Groups Broadcast (Strict Isolation) */}
      <div className="bg-white rounded-3xl p-6 border border-church-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">📁</span>
            <h2 className="text-lg font-black text-slate-900">البث حسب المجموعات (عزل تام لكل مجموعة)</h2>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {groups.length} مجموعات نشطة
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          عند اختيار مجموعة، يتم عزل شاشة العرض بالكامل لتعرض فقط الأولاد والأسر والنقاط التابعة للمراحل المرتبطة بهذه المجموعة فقط، دون أي تداخل مع مجموعات أخرى.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {groups.map((group) => {
            const isCurrentlySelected = currentFilter === `group:${group.id}` && !isSlideshowActive;
            const linkedStageIds = groupStages
              .filter((gs) => gs.group_id === group.id)
              .map((gs) => gs.stage_id);
            const linkedStages = stages.filter((s) => linkedStageIds.includes(s.id));

            return (
              <div
                key={group.id}
                className={`rounded-2xl p-5 border-2 transition-all flex flex-col justify-between gap-4 ${
                  isCurrentlySelected
                    ? 'border-amber-400 bg-amber-50/60 shadow-xl ring-4 ring-amber-300/30'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                        <FolderOpen className="w-5 h-5" />
                      </div>
                      <h3 className="font-black text-base text-slate-900">{group.name}</h3>
                    </div>
                    {isCurrentlySelected && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-600 text-white shadow-xs">
                        شاشة نشطة
                      </span>
                    )}
                  </div>

                  {group.description && (
                    <p className="text-xs text-slate-500 mb-3">{group.description}</p>
                  )}

                  {/* Included Stages */}
                  <div className="mt-3">
                    <span className="text-[11px] font-bold text-slate-500 block mb-1.5">
                      المراحل المشمولة في هذه المجموعة:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {linkedStages.length === 0 ? (
                        <span className="text-[11px] text-rose-500 font-bold">لا توجد مراحل مرتبطة</span>
                      ) : (
                        linkedStages.map((stg) => (
                          <span
                            key={stg.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-white text-slate-800 border border-slate-200 shadow-2xs"
                          >
                            <span>🎒</span>
                            <span>{stg.name}</span>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/80">
                  <button
                    onClick={() => broadcastDisplay('group', group.id, false)}
                    disabled={broadcasting}
                    className={`w-full py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-sm ${
                      isCurrentlySelected
                        ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                        : 'bg-church-800 hover:bg-church-900 text-white active:scale-95'
                    }`}
                  >
                    {isCurrentlySelected ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        <span>معروضة حالياً على الشاشات</span>
                      </>
                    ) : (
                      <>
                        <Radio className="w-4 h-4 text-amber-300" />
                        <span>بث هذه المجموعة للشاشة فوراً</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Individual Stage Broadcast */}
      <div className="bg-white rounded-3xl p-6 border border-church-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎒</span>
            <h2 className="text-lg font-black text-slate-900">البث المباشر حسب مرحلة واحدة مستقلة</h2>
          </div>
          <span className="text-xs text-slate-500 font-semibold">{stages.length} مراحل دراسية</span>
        </div>

        <p className="text-xs text-slate-500">
          إذا أردت تخصيص شاشة العرض لصف معين فقط (مثل 1 ابتدائي أو 2 إعدادي):
        </p>

        <div className="flex flex-wrap gap-2.5">
          {stages.map((stg) => {
            const isCurrentlySelected = currentFilter === `stage:${stg.id}` && !isSlideshowActive;
            return (
              <button
                key={stg.id}
                onClick={() => broadcastDisplay('stage', stg.id, false)}
                disabled={broadcasting}
                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 border ${
                  isCurrentlySelected
                    ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-md ring-2 ring-amber-300'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                }`}
              >
                <span>{stg.name.includes('إعدادي') ? '📖' : stg.name.includes('ثانوي') ? '🎓' : '🎒'}</span>
                <span>مرحلة {stg.name}</span>
                {isCurrentlySelected && <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 4: Automated Slideshow Controller */}
      <div className="bg-white rounded-3xl p-6 border border-church-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔄</span>
            <h2 className="text-lg font-black text-slate-900">التحكم في التبديل التلقائي (Slideshow Automator)</h2>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-black ${isSlideshowActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-600'}`}>
            {isSlideshowActive ? 'التبديل التلقائي نشط الآن 🟢' : 'التبديل التلقائي متوقف ⚪'}
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          يمكنك جعل شاشات العرض تبدّل تلقائياً بين المجموعات كل عدد محدد من الثواني، بحيث يرى كل قطاع مجموعته بالتناوب على الشاشة الكبيرة.
        </p>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 block">
              فترة التبديل بين كل مجموعة والأخرى:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {[10, 15, 20, 30, 60].map((sec) => (
                <button
                  key={sec}
                  onClick={() => {
                    setSlideshowInterval(sec);
                    if (isSlideshowActive) {
                      broadcastDisplay('all', null, true, sec);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    slideshowInterval === sec
                      ? 'bg-amber-500 text-slate-950 font-black border-amber-400 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {sec} ثانية
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isSlideshowActive ? (
              <button
                onClick={() => broadcastDisplay('all', null, false)}
                disabled={broadcasting}
                className="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                <span>إيقاف التبديل التلقائي</span>
              </button>
            ) : (
              <button
                onClick={() => broadcastDisplay('all', null, true, slideshowInterval)}
                disabled={broadcasting}
                className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                <span>تشغيل التبديل التلقائي لجميع الشاشات</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
