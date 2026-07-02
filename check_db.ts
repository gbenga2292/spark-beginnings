import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('employees').select('*').ilike('surname', '%OGHUMU%');
  if (error) {
    console.error('Error fetching:', error);
  } else {
    console.log('Found employees:', data.length);
    console.log(JSON.stringify(data, null, 2));
  }
}

check();
