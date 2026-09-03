import React from 'react';
import { ChildLeaderboardEntry } from '../../types/database';
import { Award, Plus, Sparkles, Star } from 'lucide-react';

interface ChildCardProps {
  entry: ChildLeaderboardEntry;
  onOpenPointsModal: () => void;
}

export const ChildCard: React.FC<ChildCardProps> = ({ entry, onOpenPointsModal }) => {
  const child = entry.child;

  return (
    <div className="bg-white rounded-3xl border border-church-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group hover:border-church-400">
      <div>
        {/* Header: Photo + Name + Tags */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-church-300 shadow-sm bg-church-50 flex items-center justify-center font-black text-xl text-church-800">
              {child.image_url ? (
                <img src={child.image_url} alt={child.full_name} className="w-full h-full object-cover" />
              ) : (
                child.full_name.charAt(0)
              )}
            </div>
            {entry.pointsToday > 0 && (
              <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-400 text-yellow-950 flex items-center justify-center text-xs font-black shadow-md border border-white">
                <Star size={12} className="fill-current" />
              </div>
            )}
          </div>

          <div className="flex-1">
            <h3 className="text-base font-black text-slate-800 group-hover:text-church-900 transition-colors">
              {child.full_name}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-church-100 text-church-900 border border-church-200">
                {child.family?.name || 'الأسرة'}
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                {child.stage?.name || 'المرحلة'}
              </span>
            </div>
          </div>
        </div>

        {/* Points Display */}
        <div className="mt-4 grid grid-cols-2 gap-2 bg-church-50/70 p-3 rounded-2xl border border-church-200/60 text-center">
          <div className="border-l border-church-200/80">
            <span className="text-[11px] font-semibold text-slate-500 block">نقاط اليوم</span>
            <span className="text-xl font-black text-amber-600 block">{entry.pointsToday}</span>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block">الإجمالي العام</span>
            <span className="text-xl font-black text-blue-600 block">{entry.pointsTotal}</span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={onOpenPointsModal}
        className="mt-4 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-church-600 to-church-700 hover:from-church-700 hover:to-church-800 text-white font-bold text-xs shadow-md active:scale-98 transition-all flex items-center justify-center gap-2"
      >
        <Award size={16} />
        <span>تسجيل نقاط (إضافة / خصم)</span>
      </button>
    </div>
  );
};
