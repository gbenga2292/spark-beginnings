import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qivyzfdxrzmzhvgjfaed.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpdnl6ZmR4cnptemh2Z2pmYWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzg2OTUsImV4cCI6MjA4Nzc1NDY5NX0.waynPrjsPHm5XyoR-Q7c7XnW4C1VbsNyi3M0jrzmZgk";

// Untyped client - tables are managed via migrations, not codegen
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
