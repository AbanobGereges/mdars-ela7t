import React from 'react';
import { PointLog } from '../../types/database';
import { Sparkles, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface LiveTickerProps {
  logs: PointLog[];
}

export const LiveTicker: React.FC<LiveTickerProps> = ({ logs }) => {
  if (!logs || logs.length === 0) return null;

  return (
    <div className="w-full bg-black/40 backdrop-blur-md border-t border-church-500/30 px-4 py-2.5 overflow-hidden">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        {/* Live Badge */}
        <div className="flex items-center gap-1.5 bg-red-600/80 text-white px-2.5 py-1 rounded-full text-xs font-black shrink-0 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
          <span>مباشر</span>
        </div>

        {/* Scrollable / Running Logs */}
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-1 text-xs md:text-sm font-medium text-slate-300">
          {logs.slice(0, 8).map((log) => {
            const isAdd = log.points > 0;
            const timeStr = new Date(log.created_at).toLocaleTimeString('ar-EG', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={log.id}
                className="flex items-center gap-2 bg-church-950/60 border border-church-700/40 px-3 py-1 rounded-xl shrink-0 shadow-sm"
              >
                <span className="text-church-300 font-bold">{log.servant?.full_name || 'خادم'}:</span>
                <span className="text-white font-bold">{log.child?.full_name || 'مخدوم'}</span>
                <span
                  className={`inline-flex items-center font-black px-1.5 py-0.5 rounded text-xs ${
                    isAdd
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                      : 'bg-rose-950 text-rose-300 border border-rose-700/50'
                  }`}
                >
                  {isAdd ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {isAdd ? `+${log.points}` : log.points}
                </span>
                <span className="text-church-400/90 text-[11px]">({log.reason})</span>
                <span className="text-slate-500 text-[10px] mr-1">{timeStr}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
