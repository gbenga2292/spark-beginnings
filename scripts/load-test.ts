import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error("❌ Error: VITE_SUPABASE_ANON_KEY is not defined in .env");
  process.exit(1);
}

console.log(`🔗 Connecting to Supabase at: ${supabaseUrl}`);
const supabase = createClient(supabaseUrl, supabaseKey);

async function runLoadTest() {
  console.log("\n🚀 Starting Stress & Limit Test...");

  // 1. Authenticate to bypass Row Level Security (RLS)
  const email = `test-user-${Date.now()}@example.com`;
  const password = `TestPass123!-${Date.now()}`;
  
  console.log(`👤 Registering test user: ${email}...`);
  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    console.error("❌ Sign up failed:", signUpError.message);
    process.exit(1);
  }
  console.log("✅ Test user registered successfully.");

  console.log("🔑 Logging in test user...");
  const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !authData.session) {
    console.error("❌ Sign in failed:", signInError?.message || "No session created");
    process.exit(1);
  }
  console.log("✅ Authenticated successfully. Session established.");

  // 2. RUN WRITE STRESS TEST
  const CONCURRENT_WRITES = 100;
  console.log(`\n✍️ Running Write Stress Test: ${CONCURRENT_WRITES} concurrent inserts...`);
  
  const writeStartTime = Date.now();
  const writePromises = Array.from({ length: CONCURRENT_WRITES }).map(async (_, index) => {
    const uniqueName = `Test Client - ${Date.now()} - ${index} - ${Math.random()}`;
    const start = Date.now();
    const { data, error } = await supabase
      .from('clients')
      .insert([{ name: uniqueName }])
      .select();
    const duration = Date.now() - start;
    return { success: !error, duration, error: error?.message };
  });

  const writeResults = await Promise.all(writePromises);
  const writeEndTime = Date.now();
  const totalWriteTime = writeEndTime - writeStartTime;

  const successfulWrites = writeResults.filter(r => r.success).length;
  const failedWrites = writeResults.filter(r => !r.success);
  const averageWriteLatency = writeResults.reduce((sum, r) => sum + r.duration, 0) / CONCURRENT_WRITES;

  console.log(`🏁 Write Test Finished in ${totalWriteTime}ms`);
  console.log(`- Successes: ${successfulWrites}/${CONCURRENT_WRITES}`);
  console.log(`- Failures: ${failedWrites.length}/${CONCURRENT_WRITES}`);
  console.log(`- Average Latency: ${averageWriteLatency.toFixed(2)}ms`);
  console.log(`- Throughput: ${(CONCURRENT_WRITES / (totalWriteTime / 1000)).toFixed(2)} writes/second`);
  
  if (failedWrites.length > 0) {
    console.log("⚠️ Sample write errors:", failedWrites.slice(0, 3).map(f => f.error));
  }

  // 3. RUN READ STRESS TEST
  const CONCURRENT_READS = 200;
  console.log(`\n📖 Running Read Stress Test: ${CONCURRENT_READS} concurrent queries...`);

  const readStartTime = Date.now();
  const readPromises = Array.from({ length: CONCURRENT_READS }).map(async () => {
    const start = Date.now();
    const { data, error } = await supabase
      .from('clients')
      .select('id, name')
      .limit(50);
    const duration = Date.now() - start;
    return { success: !error, duration, error: error?.message };
  });

  const readResults = await Promise.all(readPromises);
  const readEndTime = Date.now();
  const totalReadTime = readEndTime - readStartTime;

  const successfulReads = readResults.filter(r => r.success).length;
  const failedReads = readResults.filter(r => !r.success);
  const averageReadLatency = readResults.reduce((sum, r) => sum + r.duration, 0) / CONCURRENT_READS;

  console.log(`🏁 Read Test Finished in ${totalReadTime}ms`);
  console.log(`- Successes: ${successfulReads}/${CONCURRENT_READS}`);
  console.log(`- Failures: ${failedReads.length}/${CONCURRENT_READS}`);
  console.log(`- Average Latency: ${averageReadLatency.toFixed(2)}ms`);
  console.log(`- Throughput: ${(CONCURRENT_READS / (totalReadTime / 1000)).toFixed(2)} reads/second`);

  if (failedReads.length > 0) {
    console.log("⚠️ Sample read errors:", failedReads.slice(0, 3).map(f => f.error));
  }

  // 4. CLEANUP (Delete test client data to avoid cluttering local DB)
  console.log("\n🧹 Cleaning up test data...");
  const { error: deleteError } = await supabase
    .from('clients')
    .delete()
    .like('name', 'Test Client - %');
  
  if (deleteError) {
    console.error("⚠️ Cleanup failed:", deleteError.message);
  } else {
    console.log("✅ Cleanup successful.");
  }
}

runLoadTest().catch(console.error);
