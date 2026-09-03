import React from 'react';
import { FamilyLeaderboardEntry } from '../../types/database';
import { Home, Users } from 'lucide-react';

interface FamilyPodiumProps {
  top3Families: FamilyLeaderboardEntry[];
}

export const FamilyPodium: React.FC<FamilyPodiumProps> = ({ top3Families }) => {
  if (!top3Families || top3Families.length === 0) {
    return (
      <div className="bg-slate-900/60 backdrop-blur-xl border border-church-500/30 rounded-3xl p-8 text-center shadow-xl">
        <Home className="w-12 h-12 text-church-400 mx-auto mb-2 opacity-60" />
        <h4 className="text-xl font-bold text-white">لا توجد أسر نشطة حالياً</h4>
      </div>
    );
  }

  const medals = [
    {
      badge: '🥇 الأول',
      color: 'from-amber-400 to-yellow-500 text-yellow-950',
      border: 'border-yellow-400/80 shadow-[0_0_30px_rgba(234,179,8,0.3)]',
      bg: 'bg-gradient-to-br from-yellow-950/60 via-church-950/80 to-slate-950',
      pointsColor: 'text-yellow-300',
    },
    {
      badge: '🥈 الثاني',
      color: 'from-slate-200 to-gray-400 text-slate-950',
      border: 'border-slate-300/80 shadow-[0_0_20px_rgba(203,213,225,0.25)]',
      bg: 'bg-gradient-to-br from-slate-900/60 via-church-950/80 to-slate-950',
      pointsColor: 'text-slate-200',
    },
    {
      badge: '🥉 الثالث',
      color: 'from-amber-700 to-amber-900 text-white',
      border: 'border-amber-600/80 shadow-[0_0_20px_rgba(180,83,9,0.25)]',
      bg: 'bg-gradient-to-br from-amber-950/60 via-church-950/80 to-slate-950',
      pointsColor: 'text-amber-400',
    },
  ];

  return (
    <div className="w-full">
      {/* Header */}
      <div className="text-center mb-6">
        <h3 className="text-2xl md:text-3xl font-black text-white flex items-center justify-center gap-2">
          <span>🏠</span>
          <span className="bg-gradient-to-r from-church-200 via-amber-200 to-church-300 bg-clip-text text-transparent">
            أبطال الأسر
          </span>
          <span>🏠</span>
        </h3>
        <p className="text-church-200/70 text-xs md:text-sm mt-1 font-medium">
          مجموع نقاط أطفال كل أسرة المسجلة خلال اليوم الحالي
        </p>
      </div>

      {/* Grid of Top 3 Families */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto px-4">
        {top3Families.map((entry, index) => {
          const medal = medals[index];
          const family = entry.family;

          return (
            <div
              key={family.id}
              className={`rounded-3xl p-5 border-2 flex flex-col items-center text-center transition-all duration-300 backdrop-blur-xl ${medal.bg} ${medal.border} hover:scale-[1.02]`}
            >
              {/* Medal Header */}
              <div
                className={`px-4 py-1 rounded-full text-xs md:text-sm font-black shadow-md bg-gradient-to-r ${medal.color} mb-3`}
              >
                {medal.badge}
              </div>

              {/* Family Image / Icon */}
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden border-2 border-church-400/50 shadow-lg bg-church-900 flex items-center justify-center mb-3">
                {family.image_url ? (
                  <img
                    src={family.image_url}
                    alt={family.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Home className="w-10 h-10 text-church-400" />
                )}
              </div>

              {/* Family Name */}
              <h4 className="text-xl md:text-2xl font-black text-white">{family.name}</h4>

              {/* Stage Badge */}
              <div className="mt-2 flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-church-800/80 text-church-200 border border-church-600/40 text-xs font-bold">
                  📚 {family.stage?.name || 'المرحلة'}
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-slate-800/80 text-slate-300 text-xs flex items-center gap-1 font-medium">
                  <Users size={12} />
                  {entry.childrenCount} مخدوم
                </span>
              </div>

              {/* Family Today Points */}
              <div className="mt-4 w-full bg-black/50 border border-church-500/30 rounded-2xl py-2.5 px-4">
                <div className="text-[11px] text-church-300 font-semibold">مجموع نقاط الأسرة اليوم</div>
                <div className={`text-3xl md:text-4xl font-black ${medal.pointsColor}`}>
                  {entry.pointsToday}
                  <span className="text-sm font-bold text-church-300/80 mr-1.5">نقطة</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
