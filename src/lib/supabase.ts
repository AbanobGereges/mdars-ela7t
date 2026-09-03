import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

export function cleanSupabaseUrl(raw: string): string {
  if (!raw) return '';
  let url = raw.trim();
  const dashboardMatch = url.match(/supabase\.com\/dashboard\/project\/([a-zA-Z0-9_-]+)/);
  if (dashboardMatch && dashboardMatch[1]) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return url.replace(/\/+$/, '');
  }
}

const supabaseUrl: string = import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey: string = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

const cleanedUrl = cleanSupabaseUrl(supabaseUrl);

export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(cleanedUrl) &&
    Boolean(supabaseAnonKey) &&
    !cleanedUrl.includes('your-project-id') &&
    !cleanedUrl.includes('xyzcompany') &&
    !supabaseAnonKey.includes('dummy_anon_key')
  );
};

const safeUrl = isSupabaseConfigured() ? cleanedUrl : 'https://example.supabase.co';
const safeKey = isSupabaseConfigured()
  ? supabaseAnonKey
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder_key';

export const supabase: SupabaseClient<Database> = createClient<Database>(safeUrl, safeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});


/**
 * Upload an image file to Supabase Storage bucket 'sunday_school_media'
 */
export async function uploadMedia(file: File, folder: 'children' | 'families' | 'avatars' = 'children'): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured yet. Please update .env file with your valid project credentials.');
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('sunday_school_media')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('sunday_school_media')
    .getPublicUrl(fileName);

  return data.publicUrl;
}
