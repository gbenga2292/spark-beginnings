import { createClient } from '@supabase/supabase-js';
import { IS_LIMITED_WEB_WEB } from '@/src/lib/utils';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables');
}

// Use sessionStorage for web build to prevent session persistence on shared computers
const storage = IS_LIMITED_WEB_WEB ? window.sessionStorage : localStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: storage,
    persistSession: !IS_LIMITED_WEB_WEB, // Disable persistence for web build
    autoRefreshToken: true,
  }
});
