export type UserRole = 'admin' | 'servant' | 'display';

export function isUserRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'servant' || value === 'display';
}

export type PointRuleType = 'add' | 'deduct';

export function isPointRuleType(value: unknown): value is PointRuleType {
  return value === 'add' || value === 'deduct';
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface Stage {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined or calculated fields:
  stages?: Stage[];
  stage_ids?: string[];
  servants_count?: number;
  children_count?: number;
  servants?: Profile[];
}

export interface GroupStage {
  id: string;
  group_id: string;
  stage_id: string;
  created_at: string;
  group?: Group;
  stage?: Stage;
}

export interface GroupServant {
  id: string;
  group_id: string;
  servant_id: string;
  created_at: string;
  group?: Group;
  servant?: Profile;
}


export interface Family {
  id: string;
  stage_id: string;
  name: string;
  image_url?: string | null;
  is_active: boolean;
  created_at: string;
  // Joined relation:
  stage?: Stage;
}

export interface FamilyServant {
  id: string;
  family_id: string;
  servant_id: string;
  created_at: string;
  family?: Family;
  servant?: Profile;
}

export interface Child {
  id: string;
  code?: string | null;
  full_name: string;
  image_url?: string | null;
  stage_id: string;
  family_id: string;
  is_active: boolean;
  created_at: string;
  // Joined relations:
  stage?: Stage;
  family?: Family;
}

export interface PointRule {
  id: string;
  title: string;
  points: number;
  type: PointRuleType;
  description?: string | null;
  is_active: boolean;
  target_stage_id?: string | null;
  target_family_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PointLog {
  id: string;
  child_id: string | null;
  family_id: string;
  stage_id: string;
  rule_id?: string | null;
  points: number;
  reason: string;
  servant_id: string;
  is_reverted: boolean;
  reverted_at?: string | null;
  revert_reason?: string | null;
  reverted_by?: string | null;
  created_at: string;
  // Joined relations:
  child?: Child | null;
  family?: Family | null;
  stage?: Stage | null;
  rule?: PointRule | null;
  servant?: Profile | null;
}

// Aggregated View Models
export interface ChildLeaderboardEntry {
  child: Child;
  pointsToday: number;
  pointsTotal: number;
  lastPointAt: string | null;
  tiedChildren?: ChildLeaderboardEntry[];
}

export interface FamilyLeaderboardEntry {
  family: Family;
  pointsToday: number;
  childrenPointsToday?: number;
  directPointsToday?: number;
  childrenCount: number;
}

export interface DisplaySettings {
  id: string;
  mode: 'all' | 'group' | 'stage';
  target_id?: string | null;
  slideshow_active: boolean;
  slideshow_interval_seconds: number;
  custom_title?: string | null;
  updated_at?: string;
  updated_by?: string | null;
}

export * from './database.types';
