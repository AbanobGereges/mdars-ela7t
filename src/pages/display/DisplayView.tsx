import React from 'react';
import { useRealtimePoints } from '../../hooks/useRealtimePoints';
import { Navbar } from '../../components/layout/Navbar';
import { HeroPodium } from '../../components/display/HeroPodium';
import { FamilyPodium } from '../../components/display/FamilyPodium';
import { LiveTicker } from '../../components/display/LiveTicker';
import { RefreshCw, Sparkles, Trophy } from 'lucide-react';

export const DisplayView: React.FC = () => {
  const {
    top3ChildrenToday,
    top3FamiliesToday,
    recentLogs,
    loading,
    error,
    refreshData,
  } = useRealtimePoints();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-church-950 to-black text-white flex flex-col justify-between selection:bg-yellow-500/30">
      {/* Header */}
      <Navbar isDisplayMode={true} />

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
            {/* Section 1: 🏆 أبطال اليوم (Top 3 Children Global) */}
            <section className="animate-in fade-in zoom-in-95 duration-500">
              <HeroPodium top3={top3ChildrenToday} />
            </section>

            {/* Section 2: 🏠 أبطال الأسر (Top 3 Families) */}
            <section className="pt-4 border-t border-church-800/40 animate-in fade-in slide-in-from-bottom-6 duration-500">
              <FamilyPodium top3Families={top3FamiliesToday} />
            </section>
          </>
        )}
      </main>

      {/* Footer / Live Ticker */}
      <footer className="w-full">
        <LiveTicker logs={recentLogs} />
      </footer>
    </div>
  );
};
