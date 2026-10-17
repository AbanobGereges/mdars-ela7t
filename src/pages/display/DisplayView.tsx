import React from 'react';
import { useRealtimePoints } from '../../hooks/useRealtimePoints';
import { Navbar } from '../../components/layout/Navbar';
import { HeroPodium } from '../../components/display/HeroPodium';
import { FamilyPodium } from '../../components/display/FamilyPodium';
import { LiveTicker } from '../../components/display/LiveTicker';
import { RefreshCw, Sparkles, Trophy } from 'lucide-react';

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

  const [stages, setStages] = React.useState<Array<{ id: string; name: string }>>([]);
  const [selectedStageId, setSelectedStageId] = React.useState<string>('all');

  React.useEffect(() => {
    import('../../lib/supabase').then(({ supabase }) => {
      supabase
        .from('stages')
        .select('id, name')
        .eq('is_active', true)
        .order('sort_order')
        .then(({ data }) => {
          if (data) setStages(data);
        });
    });
  }, []);

  // Compute filtered Top 3 Children if stage selected
  const displayedChildrenTop3 = React.useMemo(() => {
    if (selectedStageId === 'all') return top3ChildrenToday;
    const filtered = children.filter((c) => c.child.stage_id === selectedStageId);
    return filtered.slice(0, 3).map((hero) => ({
      ...hero,
      tiedChildren: filtered.filter(
        (c) => c.child.id !== hero.child.id && hero.pointsToday > 0 && c.pointsToday === hero.pointsToday
      ),
    }));
  }, [children, top3ChildrenToday, selectedStageId]);

  // Compute filtered Top 3 Families if stage selected
  const displayedFamiliesTop3 = React.useMemo(() => {
    if (selectedStageId === 'all') return top3FamiliesToday;
    return allFamiliesToday
      .filter((f) => f.family.stage_id === selectedStageId)
      .slice(0, 3);
  }, [allFamiliesToday, top3FamiliesToday, selectedStageId]);

  // Filtered recent logs for ticker
  const displayedLogs = React.useMemo(() => {
    if (selectedStageId === 'all') return recentLogs;
    return recentLogs.filter((l) => l.stage_id === selectedStageId);
  }, [recentLogs, selectedStageId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-church-950 to-black text-white flex flex-col justify-between selection:bg-yellow-500/30">
      {/* Header */}
      <Navbar isDisplayMode={true} />

      {/* Stage Selector Bar on TV */}
      {stages.length > 0 && (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-3 flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedStageId('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-black transition-all backdrop-blur-md border ${
              selectedStageId === 'all'
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg scale-105'
                : 'bg-white/10 text-white/80 border-white/10 hover:bg-white/20'
            }`}
          >
            🌟 جميع المراحل
          </button>
          {stages.map((stg) => (
            <button
              key={stg.id}
              onClick={() => setSelectedStageId(stg.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-black transition-all backdrop-blur-md border ${
                selectedStageId === stg.id
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg scale-105'
                  : 'bg-white/10 text-white/80 border-white/10 hover:bg-white/20'
              }`}
            >
              {stg.name}
            </button>
          ))}
        </div>
      )}

      {/* Main Presentation Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col justify-center gap-12">
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
            {/* Section 1: 🏆 أبطال اليوم */}
            <section className="animate-in fade-in zoom-in-95 duration-500">
              <HeroPodium top3={displayedChildrenTop3} />
            </section>

            {/* Section 2: 🏠 أبطال الأسر */}
            <section className="pt-4 border-t border-church-800/40 animate-in fade-in slide-in-from-bottom-6 duration-500">
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
