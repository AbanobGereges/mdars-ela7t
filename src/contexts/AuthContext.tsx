import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Profile, UserRole, isUserRole } from '../types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  isApproved: boolean;
  assignedFamilies: string[];
  assignedGroups: string[];
  assignedStages: string[];
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, pass: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, pass: string, fullName: string, requestedFamilyId?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assignedFamilies, setAssignedFamilies] = useState<string[]>([]);
  const [assignedGroups, setAssignedGroups] = useState<string[]>([]);
  const [assignedStages, setAssignedStages] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const isConfigured = isSupabaseConfigured();

  const fetchProfileAndAssignments = useCallback(async (userId: string) => {
    try {
      // 1. Fetch user profile
      const { data: profData, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profError) {
        console.error('Error fetching profile:', profError);
        setProfile(null);
        return;
      }

      // 2. Set profile and fetch assigned groups, stages & families
      if (profData) {
        const validRole: UserRole = isUserRole(profData.role) ? profData.role : 'servant';
        const profileObj: Profile = {
          id: profData.id,
          email: profData.email,
          full_name: profData.full_name,
          role: validRole,
          is_approved: profData.is_approved,
          created_at: profData.created_at,
          updated_at: profData.updated_at,
        };
        setProfile(profileObj);

        if (validRole === 'admin') {
          // Admin has access to all groups, stages, families
          const [famsRes, stgsRes, grpsRes] = await Promise.all([
            supabase.from('families').select('id'),
            supabase.from('stages').select('id'),
            supabase.from('groups').select('id'),
          ]);
          if (famsRes.data) setAssignedFamilies(famsRes.data.map((f) => f.id));
          if (stgsRes.data) setAssignedStages(stgsRes.data.map((s) => s.id));
          if (grpsRes.data) setAssignedGroups(grpsRes.data.map((g) => g.id));
        } else if (validRole === 'servant') {
          // 1. Fetch servant's active groups
          const { data: userGroupServants } = await supabase
            .from('group_servants')
            .select('group_id, group:groups(id, is_active)')
            .eq('servant_id', userId);

          const activeGroupIds = (userGroupServants || [])
            .filter((gs: any) => gs.group?.is_active !== false)
            .map((gs: any) => gs.group_id);

          setAssignedGroups(activeGroupIds);

          // 2. Fetch stages permitted to these groups
          let permittedStageIds: string[] = [];
          if (activeGroupIds.length > 0) {
            const { data: groupStagesData } = await supabase
              .from('group_stages')
              .select('stage_id')
              .in('group_id', activeGroupIds);

            if (groupStagesData) {
              permittedStageIds = Array.from(new Set(groupStagesData.map((gs) => gs.stage_id)));
            }
          }

          setAssignedStages(permittedStageIds);

          // 3. Fetch permitted families
          let allowedFamilyIds: string[] = [];
          if (permittedStageIds.length > 0) {
            const { data: stageFams } = await supabase
              .from('families')
              .select('id')
              .in('stage_id', permittedStageIds)
              .eq('is_active', true);

            const validFamIdsInStages = (stageFams || []).map((f) => f.id);

            // Check if servant has specific family assignments
            const { data: fsData } = await supabase
              .from('family_servants')
              .select('family_id')
              .eq('servant_id', userId);

            if (fsData && fsData.length > 0) {
              const specificFams = fsData
                .map((f) => f.family_id)
                .filter((fId) => validFamIdsInStages.includes(fId));
              allowedFamilyIds = specificFams.length > 0 ? specificFams : validFamIdsInStages;
            } else {
              allowedFamilyIds = validFamIdsInStages;
            }
          }

          setAssignedFamilies(allowedFamilyIds);
        }
      } else {
        setProfile(null);
        setAssignedFamilies([]);
        setAssignedGroups([]);
        setAssignedStages([]);
      }
    } catch (err) {
      console.error('Failed to load user profile details:', err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfileAndAssignments(user.id);
    }
  }, [user, fetchProfileAndAssignments]);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;

    // Check current active session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!mounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        fetchProfileAndAssignments(currentSession.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          await fetchProfileAndAssignments(newSession.user.id);
        } else {
          setProfile(null);
          setAssignedFamilies([]);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [isConfigured, fetchProfileAndAssignments]);

  const signIn = async (email: string, pass: string) => {
    if (!isConfigured) {
      return { error: new Error('يرجى أولاً وضع بيانات Supabase في ملف .env') };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, pass: string, fullName: string, requestedFamilyId?: string) => {
    if (!isConfigured) {
      return { error: new Error('يرجى أولاً وضع بيانات Supabase في ملف .env') };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          full_name: fullName,
          requested_family_id: requestedFamilyId || null,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setAssignedFamilies([]);
    setAssignedGroups([]);
    setAssignedStages([]);
  };

  const role: UserRole | null = profile?.role && isUserRole(profile.role) ? profile.role : null;
  const isApproved = profile?.is_approved ?? false;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isApproved,
        assignedFamilies,
        assignedGroups,
        assignedStages,
        loading,
        isConfigured,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
