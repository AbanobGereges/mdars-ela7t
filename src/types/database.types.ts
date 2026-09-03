export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      children: {
        Row: {
          birth_date: string | null;
          code: string | null;
          created_at: string;
          family_id: string;
          full_name: string;
          id: string;
          image_url: string | null;
          is_active: boolean;
          notes: string | null;
          phone: string | null;
          stage_id: string;
        };
        Insert: {
          birth_date?: string | null;
          code?: string | null;
          created_at?: string;
          family_id: string;
          full_name: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          notes?: string | null;
          phone?: string | null;
          stage_id: string;
        };
        Update: {
          birth_date?: string | null;
          code?: string | null;
          created_at?: string;
          family_id?: string;
          full_name?: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          notes?: string | null;
          phone?: string | null;
          stage_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "children_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "children_stage_id_fkey";
            columns: ["stage_id"];
            isOneToOne: false;
            referencedRelation: "stages";
            referencedColumns: ["id"];
          }
        ];
      };
      families: {
        Row: {
          created_at: string;
          id: string;
          image_url: string | null;
          is_active: boolean;
          name: string;
          stage_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name: string;
          stage_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name?: string;
          stage_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "families_stage_id_fkey";
            columns: ["stage_id"];
            isOneToOne: false;
            referencedRelation: "stages";
            referencedColumns: ["id"];
          }
        ];
      };
      family_servants: {
        Row: {
          created_at: string;
          family_id: string;
          id: string;
          servant_id: string;
        };
        Insert: {
          created_at?: string;
          family_id: string;
          id?: string;
          servant_id: string;
        };
        Update: {
          created_at?: string;
          family_id?: string;
          id?: string;
          servant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "family_servants_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "family_servants_servant_id_fkey";
            columns: ["servant_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      point_logs: {
        Row: {
          child_id: string | null;
          created_at: string;
          family_id: string;
          id: string;
          is_reverted: boolean;
          points: number;
          reason: string;
          revert_reason: string | null;
          reverted_at: string | null;
          reverted_by: string | null;
          rule_id: string | null;
          servant_id: string;
          stage_id: string;
        };
        Insert: {
          child_id?: string | null;
          created_at?: string;
          family_id: string;
          id?: string;
          is_reverted?: boolean;
          points: number;
          reason: string;
          revert_reason?: string | null;
          reverted_at?: string | null;
          reverted_by?: string | null;
          rule_id?: string | null;
          servant_id: string;
          stage_id: string;
        };
        Update: {
          child_id?: string | null;
          created_at?: string;
          family_id?: string;
          id?: string;
          is_reverted?: boolean;
          points?: number;
          reason?: string;
          revert_reason?: string | null;
          reverted_at?: string | null;
          reverted_by?: string | null;
          rule_id?: string | null;
          servant_id?: string;
          stage_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "point_logs_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "point_logs_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "point_logs_rule_id_fkey";
            columns: ["rule_id"];
            isOneToOne: false;
            referencedRelation: "point_rules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "point_logs_servant_id_fkey";
            columns: ["servant_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "point_logs_stage_id_fkey";
            columns: ["stage_id"];
            isOneToOne: false;
            referencedRelation: "stages";
            referencedColumns: ["id"];
          }
        ];
      };
      point_rules: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          points: number;
          target_family_id: string | null;
          target_stage_id: string | null;
          title: string;
          type: 'add' | 'deduct' | string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          points: number;
          target_family_id?: string | null;
          target_stage_id?: string | null;
          title: string;
          type: 'add' | 'deduct' | string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          points?: number;
          target_family_id?: string | null;
          target_stage_id?: string | null;
          title?: string;
          type?: 'add' | 'deduct' | string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_approved: boolean;
          role: 'admin' | 'servant' | 'display' | string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string;
          full_name: string;
          id?: string;
          is_approved?: boolean;
          role?: 'admin' | 'servant' | 'display' | string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          is_approved?: boolean;
          role?: 'admin' | 'servant' | 'display' | string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stages: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      approve_user: {
        Args: {
          target_user_id: string;
        };
        Returns: undefined;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_approved_user: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      servant_has_family: {
        Args: {
          check_family_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
