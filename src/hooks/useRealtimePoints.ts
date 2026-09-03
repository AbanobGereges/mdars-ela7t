import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Child,
  Family,
  Stage,
  PointLog,
  ChildLeaderboardEntry,
  FamilyLeaderboardEntry,
} from '../types/database';
import { sounds, triggerConfetti } from '../lib/effects';

interface RealtimePointsState {
  children: ChildLeaderboardEntry[];
  top3ChildrenToday: ChildLeaderboardEntry[];
  top3FamiliesToday: FamilyLeaderboardEntry[];
  allFamiliesToday: FamilyLeaderboardEntry[];
  recentLogs: PointLog[];
  totalPointsToday: number;
  loading: boolean;
  error: string | null;
  lastUpdated: Date;
  refreshData: () => Promise<void>;
}

export function useRealtimePoints(): RealtimePointsState {
  const [children, setChildren] = useState<ChildLeaderboardEntry[]>([]);
  const [top3ChildrenToday, setTop3ChildrenToday] = useState<ChildLeaderboardEntry[]>([]);
  const [top3FamiliesToday, setTop3FamiliesToday] = useState<FamilyLeaderboardEntry[]>([]);
  const [allFamiliesToday, setAllFamiliesToday] = useState<FamilyLeaderboardEntry[]>([]);
  const [recentLogs, setRecentLogs] = useState<PointLog[]>([]);
  const [totalPointsToday, setTotalPointsToday] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const calculatePoints = useCallback(
    (
      rawChildren: (Child & { stage?: Stage; family?: Family })[],
      rawFamilies: (Family & { stage?: Stage })[],
      rawLogs: PointLog[]
    ) => {
      // Calculate start of today (00:00:00 in local time)
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      // Maps to aggregate points
      const childPointsTodayMap = new Map<string, number>();
      const childPointsTotalMap = new Map<string, number>();
      const childLastPointAtMap = new Map<string, string>();
      const familyPointsTodayMap = new Map<string, number>();

      let runningTotalToday = 0;

      // Process logs
      rawLogs.forEach((log) => {
        // Skip reverted logs
        if (log.is_reverted) return;

        const logTime = new Date(log.created_at).getTime();
        const pts = log.points || 0;

        // If this point log belongs to a child, calculate child leaderboard points
        if (log.child_id) {
          // Total lifetime points
          const prevTotal = childPointsTotalMap.get(log.child_id) || 0;
          childPointsTotalMap.set(log.child_id, prevTotal + pts);

          // Today's points
          if (logTime >= startOfToday) {
            const prevToday = childPointsTodayMap.get(log.child_id) || 0;
            childPointsTodayMap.set(log.child_id, prevToday + pts);

            // Track latest point transaction time for tie-breaking
            const currentLast = childLastPointAtMap.get(log.child_id);
            if (!currentLast || new Date(log.created_at).getTime() > new Date(currentLast).getTime()) {
              childLastPointAtMap.set(log.child_id, log.created_at);
            }
          }
        }

        // Family points today (includes child logs and direct family point logs)
        if (logTime >= startOfToday) {
          const prevFamToday = familyPointsTodayMap.get(log.family_id) || 0;
          familyPointsTodayMap.set(log.family_id, prevFamToday + pts);

          runningTotalToday += pts;
        }
      });

      // 1. Build ChildLeaderboardEntry array
      const childEntries: ChildLeaderboardEntry[] = rawChildren
        .filter((c) => c.is_active)
        .map((c) => ({
          child: c,
          pointsToday: childPointsTodayMap.get(c.id) || 0,
          pointsTotal: childPointsTotalMap.get(c.id) || 0,
          lastPointAt: childLastPointAtMap.get(c.id) || null,
        }));

      // Sort according to tie-breaker rules:
      // 1. pointsToday DESC
      // 2. lastPointAt DESC (most recent transaction first)
      // 3. full_name ASC (stable alphabetical order)
      childEntries.sort((a, b) => {
        if (b.pointsToday !== a.pointsToday) {
          return b.pointsToday - a.pointsToday;
        }
        const timeA = a.lastPointAt ? new Date(a.lastPointAt).getTime() : 0;
        const timeB = b.lastPointAt ? new Date(b.lastPointAt).getTime() : 0;
        if (timeB !== timeA) {
          return timeB - timeA;
        }
        return (a.child.full_name || '').localeCompare(b.child.full_name || '', 'ar');
      });

      // Global Top 3 Children Today
      const top3Children = childEntries.slice(0, 3);

      // 2. Build FamilyLeaderboardEntry array
      const familyEntries: FamilyLeaderboardEntry[] = rawFamilies
        .filter((f) => f.is_active)
        .map((f) => {
          const count = rawChildren.filter((c) => c.family_id === f.id && c.is_active).length;
          return {
            family: f,
            pointsToday: familyPointsTodayMap.get(f.id) || 0,
            childrenCount: count,
          };
        });

      familyEntries.sort((a, b) => {
        if (b.pointsToday !== a.pointsToday) {
          return b.pointsToday - a.pointsToday;
        }
        return (a.family.name || '').localeCompare(b.family.name || '', 'ar');
      });

      const top3Families = familyEntries.slice(0, 3);

      setChildren(childEntries);
      setTop3ChildrenToday(top3Children);
      setAllFamiliesToday(familyEntries);
      setTop3FamiliesToday(top3Families);
      setTotalPointsToday(runningTotalToday);
      setRecentLogs(rawLogs.slice(0, 25));
      setLastUpdated(new Date());
    },
    []
  );

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      // Parallel fetch of children, families, stages, rules, logs, and profiles independently
      // This prevents PostgREST relationship ambiguity errors (e.g. multiple foreign keys to profiles in point_logs)
      const [childrenRes, familiesRes, stagesRes, rulesRes, logsRes, profilesRes] = await Promise.all([
        supabase.from('children').select('*').order('full_name'),
        supabase.from('families').select('*').order('name'),
        supabase.from('stages').select('*').order('sort_order'),
        supabase.from('point_rules').select('*').order('points', { ascending: false }),
        supabase.from('point_logs').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at'),
      ]);

      if (childrenRes.error) {
        console.warn('children fetch error:', childrenRes.error);
        throw childrenRes.error;
      }
      if (familiesRes.error) {
        console.warn('families fetch error:', familiesRes.error);
        throw familiesRes.error;
      }
      if (logsRes.error) {
        console.warn('point_logs fetch error:', logsRes.error);
        throw logsRes.error;
      }

      const stages = stagesRes.data || [];
      const rules = rulesRes.data || [];
      const profiles = profilesRes.data || [];

      // Link stages to families
      const families: (Family & { stage?: Stage })[] = (familiesRes.data || []).map((f) => ({
        ...f,
        stage: stages.find((s) => s.id === f.stage_id) || undefined,
      }));

      // Link families & stages to children
      const childrenList: (Child & { stage?: Stage; family?: Family })[] = (childrenRes.data || []).map((c) => ({
        ...c,
        family: families.find((f) => f.id === c.family_id) || undefined,
        stage: stages.find((s) => s.id === c.stage_id) || undefined,
      }));

      // Enrich point_logs with full relations in memory
      const logsList: PointLog[] = (logsRes.data || []).map((l) => ({
        ...l,
        child: childrenList.find((c) => c.id === l.child_id) || null,
        family: families.find((f) => f.id === l.family_id) || null,
        stage: stages.find((s) => s.id === l.stage_id) || null,
        servant: profiles.find((p) => p.id === l.servant_id) || null,
        rule: rules.find((r) => r.id === l.rule_id) || null,
      }));

      calculatePoints(childrenList, families, logsList);
      setError(null);
    } catch (err: unknown) {
      console.error('Error in useRealtimePoints fetch:', err);
      const postgrestMsg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : null;
      setError(postgrestMsg || (err instanceof Error ? err.message : 'حدث خطأ في جلب بيانات النقاط'));
    } finally {
      setLoading(false);
    }
  }, [calculatePoints]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    fetchData();

    // Setup Supabase Realtime channel
    const channel = supabase
      .channel('church-points-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'point_logs' },
        (payload) => {
          // Play audio or trigger visual alert on inserts
          if (payload.eventType === 'INSERT') {
            const newLog = payload.new as PointLog;
            if (newLog.points > 0) {
              sounds.playSuccess();
              triggerConfetti();
            } else {
              sounds.playDeduct();
            }
          }
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'children' },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'families' },
        () => {
          fetchData();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Connected successfully
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          console.warn('Realtime channel error, retrying in 5s...');
          setTimeout(fetchData, 5000);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchData]);

  return {
    children,
    top3ChildrenToday,
    top3FamiliesToday,
    allFamiliesToday,
    recentLogs,
    totalPointsToday,
    loading,
    error,
    lastUpdated,
    refreshData: fetchData,
  };
}
