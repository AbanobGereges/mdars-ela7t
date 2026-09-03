import React from 'react';
import { ChildLeaderboardEntry } from '../../types/database';
import { Crown, Sparkles } from 'lucide-react';

interface HeroPodiumProps {
  top3: ChildLeaderboardEntry[];
}

export const HeroPodium: React.FC<HeroPodiumProps> = ({ top3 }) => {
  if (!top3 || top3.length === 0) {
    return (
      <div className="bg-slate-900/60 backdrop-blur-xl border border-church-500/30 rounded-3xl p-12 text-center shadow-2xl">
        <div className="w-20 h-20 mx-auto rounded-full bg-church-500/20 flex items-center justify-center text-4xl mb-4 border border-church-400/30 animate-pulse">
          🏆
        </div>
        <h3 className="text-2xl font-bold text-church-200">في انتظار بدء إضافة نقاط اليوم</h3>
        <p className="text-slate-400 mt-2 text-base">سيتوج هنا أعلى 3 أولاد على مستوى جميع الأسر والمراحل فور تسجيل النقاط</p>
      </div>
    );
  }

  // Medals & styles definition for Rank 1 (Gold), Rank 2 (Silver), Rank 3 (Bronze)
  const rankStyles = [
    {
      rank: 1,
      badge: '🥇 الأول',
      label: 'المركز الأول',
      medalColor: 'from-amber-400 via-yellow-300 to-amber-500',
      borderGlow: 'border-yellow-400 shadow-[0_0_40px_rgba(234,179,8,0.45)]',
      pedestalHeight: 'h-40 md:h-52',
      scale: 'scale-105 z-20',
      order: 'order-1 md:order-2', // Center in desktop view
      crown: true,
      cardBg: 'bg-gradient-to-b from-yellow-950/80 via-church-950/90 to-black/90',
      pointsColor: 'text-yellow-300',
    },
    {
      rank: 2,
      badge: '🥈 الثاني',
      label: 'المركز الثاني',
      medalColor: 'from-slate-300 via-gray-200 to-slate-400',
      borderGlow: 'border-slate-300 shadow-[0_0_25px_rgba(203,213,225,0.3)]',
      pedestalHeight: 'h-28 md:h-36',
      scale: 'z-10',
      order: 'order-2 md:order-1', // Left in desktop
      crown: false,
      cardBg: 'bg-gradient-to-b from-slate-900/80 via-church-950/90 to-black/90',
      pointsColor: 'text-slate-200',
    },
    {
      rank: 3,
      badge: '🥉 الثالث',
      label: 'المركز الثالث',
      medalColor: 'from-amber-700 via-amber-600 to-amber-800',
      borderGlow: 'border-amber-700 shadow-[0_0_25px_rgba(180,83,9,0.3)]',
      pedestalHeight: 'h-20 md:h-28',
      scale: 'z-10',
      order: 'order-3 md:order-3', // Right in desktop
      crown: false,
      cardBg: 'bg-gradient-to-b from-amber-950/80 via-church-950/90 to-black/90',
      pointsColor: 'text-amber-400',
    },
  ];

  return (
    <div className="w-full">
      {/* Title Section */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-yellow-500/20 border border-yellow-400/40 text-yellow-300 px-5 py-2 rounded-full text-base font-bold shadow-lg mb-2">
          <Sparkles size={20} className="animate-spin" />
          <span>التصنيف العام لليوم — أعلى 3 أولاد</span>
          <Sparkles size={20} className="animate-spin" />
        </div>
        <h2 className="text-3xl md:text-5xl font-black text-white tracking-wide drop-shadow-lg flex items-center justify-center gap-3">
          <span>🏆</span>
          <span className="bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
            أبطال اليوم
          </span>
          <span>🏆</span>
        </h2>
        <p className="text-church-200/80 text-sm md:text-base mt-2 font-medium">
          ترتيب شامل لكافة المراحل والأسر مع تطبيق قواعد فك التعادل اللحظية
        </p>
      </div>

      {/* Podium Grid */}
      <div className="flex flex-col md:flex-row items-center md:items-end justify-center gap-6 max-w-5xl mx-auto px-4">
        {top3.map((entry, index) => {
          const config = rankStyles[index];
          const child = entry.child;

          return (
            <div
              key={child.id}
              className={`w-full md:w-1/3 flex flex-col items-center transition-all duration-500 ${config.order} ${config.scale}`}
            >
              {/* Card */}
              <div
                className={`w-full rounded-3xl p-6 border-2 flex flex-col items-center text-center transition-all duration-300 backdrop-blur-xl ${config.cardBg} ${config.borderGlow} hover:-translate-y-2`}
              >
                {/* Crown for 1st place */}
                {config.crown && (
                  <div className="relative -mt-12 mb-2 animate-bounce">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg border-2 border-yellow-200">
                      <Crown size={36} className="text-yellow-950 fill-yellow-950" />
                    </div>
                  </div>
                )}

                {/* Child Image / Avatar */}
                <div className="relative mb-4">
                  <div className="w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-yellow-400/80 shadow-2xl bg-church-900 flex items-center justify-center">
                    {child.image_url ? (
                      <img
                        src={child.image_url}
                        alt={child.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-church-950 text-church-300 text-4xl font-bold">
                        {child.full_name.charAt(0)}
                      </div>
                    )}
                  </div>
                  {/* Rank Badge */}
                  <div
                    className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs md:text-sm font-black text-slate-950 shadow-lg bg-gradient-to-r ${config.medalColor} border border-white/50`}
                  >
                    {config.badge}
                  </div>
                </div>

                {/* Child Name */}
                <h3 className="text-2xl md:text-3xl font-black text-white mt-2 drop-shadow-md">
                  {child.full_name}
                </h3>

                {/* Family & Stage Tags */}
                <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                  <span className="px-3 py-1 rounded-xl bg-church-800/80 text-church-200 border border-church-600/50 text-xs md:text-sm font-bold shadow-sm">
                    🏠 {child.family?.name || 'أسرة الخدمة'}
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-blue-900/60 text-blue-200 border border-blue-600/50 text-xs md:text-sm font-bold shadow-sm">
                    📚 {child.stage?.name || 'المرحلة'}
                  </span>
                </div>

                {/* Points Today Counter */}
                <div className="mt-5 w-full bg-black/50 border border-church-500/30 rounded-2xl py-3 px-4 shadow-inner">
                  <div className="text-xs text-church-300 font-semibold mb-1">نقاط اليوم الحالية</div>
                  <div className={`text-4xl md:text-5xl font-black tracking-wider ${config.pointsColor}`}>
                    {entry.pointsToday}
                    <span className="text-lg font-bold text-church-300/80 mr-1.5">نقطة</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    إجمالي النقاط العام: {entry.pointsTotal} نقطة
                  </div>
                </div>
              </div>

              {/* Pedestal block */}
              <div
                className={`w-4/5 ${config.pedestalHeight} rounded-b-3xl bg-gradient-to-b from-church-800/90 to-church-950 border-x border-b border-church-500/30 shadow-2xl flex items-center justify-center`}
              >
                <span className="text-5xl md:text-6xl font-black text-church-400/30 select-none">
                  #{config.rank}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
