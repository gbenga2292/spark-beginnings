// Load the env first
require('dotenv').config();
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables!");
  process.exit(1);
}

const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

async function test() {
  const siteId = '3d819f1b-5f20-4ca4-82b5-2e3042914e71'; // Bristol Road
  const year = 2026;
  const startDateStr = `${year}-01-01T00:00:00Z`;
  const endDateStr = `${year}-12-31T23:59:59.999Z`;
  const startDateDbStr = `${year}-01-01`;
  const endDateDbStr = `${year}-12-31`;

  console.log(`Querying for Site: ${siteId}, Year: ${year}`);

  const { data: entries, error: err1 } = await supabase
    .from('site_journal_entries')
    .select('*')
    .eq('site_id', siteId)
    .gte('created_at', startDateStr)
    .lte('created_at', endDateStr);

  console.log("site_journal_entries:", entries ? entries.length : 0, "Error:", err1);

  const { data: mData, error: err3 } = await supabase
    .from('operations_daily_logs')
    .select('*')
    .eq('site_id', siteId)
    .gte('date', startDateDbStr)
    .lte('date', endDateDbStr);

  console.log("operations_daily_logs:", mData ? mData.length : 0, "Error:", err3);
}

test();
