import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error("❌ Error: VITE_SUPABASE_ANON_KEY is not defined in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Simulation parameters
const NUM_EMPLOYEES = 50;
const YEARS = 10;
const BATCH_SIZE = 1000;

async function simulateData() {
  console.log(`🚀 Starting 10-Year Simulation for ${NUM_EMPLOYEES} employees...`);
  console.log(`🔗 Target Database URL: ${supabaseUrl}`);

  // 1. Authenticate to bypass Row Level Security
  const email = `admin-sim-${Date.now()}@example.com`;
  const password = `AdminSim123!-${Date.now()}`;
  
  console.log(`👤 Registering simulator session...`);
  const { error: signUpError } = await supabase.auth.signUp({ email, password });
  if (signUpError) {
    console.error("❌ Auth sign up failed:", signUpError.message);
    process.exit(1);
  }

  const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError || !authData.session) {
    console.error("❌ Auth sign in failed:", signInError?.message);
    process.exit(1);
  }
  console.log("✅ Authenticated successfully.");

  // 2. Insert mock departments
  console.log("🏢 Creating mock departments...");
  const departmentsList = ['Operations', 'HR', 'Finance', 'Engineering', 'Safety'];
  const { error: deptError } = await supabase
    .from('departments')
    .insert(departmentsList.map(name => ({ name })))
    .select();
  if (deptError && !deptError.message.includes('unique constraint')) {
    console.log("⚠️ Department warning:", deptError.message);
  }

  // 3. Insert mock positions
  console.log("👷 Creating mock positions...");
  const positionsList = ['Manager', 'Supervisor', 'Technician', 'Operator', 'Accountant'];
  const { error: posError } = await supabase
    .from('positions')
    .insert(positionsList.map(name => ({ name })))
    .select();
  if (posError && !posError.message.includes('unique constraint')) {
    console.log("⚠️ Position warning:", posError.message);
  }

  // 4. Insert 50 employees
  console.log(`👥 Creating ${NUM_EMPLOYEES} employees...`);
  const employeesToInsert = Array.from({ length: NUM_EMPLOYEES }).map((_, i) => {
    const index = i + 1;
    return {
      surname: `Surname-${index}`,
      firstname: `Firstname-${index}`,
      department: departmentsList[i % departmentsList.length],
      position: positionsList[i % positionsList.length],
      staff_type: 'INTERNAL',
      start_date: '2016-01-01',
      status: 'Active',
      monthly_salaries: {
        jan: 50000 + (i * 2000), feb: 50000 + (i * 2000), mar: 50000 + (i * 2000),
        apr: 50000 + (i * 2000), may: 50000 + (i * 2000), jun: 50000 + (i * 2000),
        jul: 50000 + (i * 2000), aug: 50000 + (i * 2000), sep: 50000 + (i * 2000),
        oct: 50000 + (i * 2000), nov: 50000 + (i * 2000), dec: 50000 + (i * 2000)
      }
    };
  });

  const { data: insertedEmployees, error: empError } = await supabase
    .from('employees')
    .insert(employeesToInsert)
    .select();

  if (empError || !insertedEmployees || insertedEmployees.length === 0) {
    console.error("❌ Failed to create employees:", empError?.message);
    process.exit(1);
  }
  console.log(`✅ Successfully created ${insertedEmployees.length} employees.`);

  // 5. Generate 10 years of daily attendance records
  console.log(`📅 Generating 10 years of attendance logs...`);
  
  const startDate = new Date('2016-01-01');
  const endDate = new Date('2025-12-31');
  
  // Collect all working dates
  const dates: string[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Weekdays only
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    current.setDate(current.getDate() + 1);
  }

  const totalDates = dates.length;
  console.log(`ℹ️ Total working days per employee over 10 years: ${totalDates}`);
  console.log(`📈 Expected total attendance rows: ${totalDates * NUM_EMPLOYEES}`);

  let attendanceBatch: any[] = [];
  let insertedCount = 0;
  const insertStart = Date.now();

  for (const employee of insertedEmployees) {
    for (const dateStr of dates) {
      const dateObj = new Date(dateStr);
      const monthIndex = dateObj.getMonth() + 1; // 1-12
      
      attendanceBatch.push({
        date: dateStr,
        staff_id: employee.id,
        staff_name: `${employee.firstname} ${employee.surname}`,
        position: employee.position,
        day: 'Yes',
        night: Math.random() > 0.85 ? 'Yes' : 'No', // Occasional night shift
        is_present: 'Yes',
        mth: monthIndex,
        dow: dateObj.getDay(),
        ot: Math.random() > 0.9 ? Math.floor(Math.random() * 4) + 1 : 0, // Random overtime
        created_at: new Date().toISOString()
      });

      // If batch size is reached, upload to database
      if (attendanceBatch.length >= BATCH_SIZE) {
        const { error } = await supabase
          .from('attendance_records')
          .insert(attendanceBatch);

        if (error) {
          console.error("❌ Error inserting batch:", error.message);
          process.exit(1);
        }

        insertedCount += attendanceBatch.length;
        process.stdout.write(`⏳ Uploaded ${insertedCount} / ${totalDates * NUM_EMPLOYEES} rows...\r`);
        attendanceBatch = [];
      }
    }
  }

  // Upload remaining records
  if (attendanceBatch.length > 0) {
    const { error } = await supabase
      .from('attendance_records')
      .insert(attendanceBatch);
    if (error) {
      console.error("❌ Error inserting final batch:", error.message);
      process.exit(1);
    }
    insertedCount += attendanceBatch.length;
  }

  const totalDuration = Date.now() - insertStart;
  console.log(`\n🎉 Simulation Complete!`);
  console.log(`- Created Employees: ${NUM_EMPLOYEES}`);
  console.log(`- Created Attendance Records: ${insertedCount}`);
  console.log(`- Total Upload Time: ${(totalDuration / 1000).toFixed(2)} seconds`);
  console.log(`- Insert Rate: ${(insertedCount / (totalDuration / 1000)).toFixed(2)} rows/second`);
}

simulateData().catch(console.error);
