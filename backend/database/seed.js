const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function seed() {
  console.log('Connecting to MySQL host:', process.env.DB_HOST || (process.env.DATABASE_URL ? 'Cloud DB' : 'localhost'));
  
  let connConfig;
  if (process.env.DATABASE_URL || process.env.MYSQL_URL) {
    connConfig = {
      uri: process.env.DATABASE_URL || process.env.MYSQL_URL,
      ssl: (process.env.DB_SSL === 'false') ? undefined : { rejectUnauthorized: false }
    };
  } else {
    const isCloudHost = process.env.DB_HOST && !['localhost', '127.0.0.1'].includes(process.env.DB_HOST);
    const isSsl = process.env.DB_SSL === 'true' || isCloudHost;
    connConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      ssl: isSsl ? { rejectUnauthorized: false } : undefined
    };
    if (process.env.DB_NAME) {
      connConfig.database = process.env.DB_NAME;
    }
  }

  const connection = await mysql.createConnection(connConfig);
  console.log('Connected to MySQL server.');

  const dbName = process.env.DB_NAME || 'feeflow';
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  } catch (err) {
    console.log(`Note: Database creation skipped or already managed (${err.message})`);
  }

  try {
    await connection.changeUser({ database: dbName });
  } catch (err) {
    console.log(`Using existing database context: ${dbName}`);
  }

  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  // Clean comments and split by semicolon
  const statements = schemaSql
    .replace(/--.*$/gm, '')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.toLowerCase().startsWith('create database') && !s.toLowerCase().startsWith('use '));

  for (const statement of statements) {
    await connection.query(statement);
  }
  console.log('Tables verified.');

  // Clear existing data in reverse order of foreign keys for clean re-seed
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  await connection.query('TRUNCATE TABLE notifications');
  await connection.query('TRUNCATE TABLE receipts');
  await connection.query('TRUNCATE TABLE installments');
  await connection.query('TRUNCATE TABLE payments');
  await connection.query('TRUNCATE TABLE student_fees');
  await connection.query('TRUNCATE TABLE fee_structures');
  await connection.query('TRUNCATE TABLE scholarships');
  await connection.query('TRUNCATE TABLE discounts');
  await connection.query('TRUNCATE TABLE students');
  await connection.query('TRUNCATE TABLE admins');
  await connection.query('TRUNCATE TABLE users');
  await connection.query('TRUNCATE TABLE academic_years');
  await connection.query('TRUNCATE TABLE departments');
  await connection.query('TRUNCATE TABLE courses');
  await connection.query('TRUNCATE TABLE institute_settings');
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('Cleared existing tables.');

  // 1. Institute Settings
  await connection.query(`
    INSERT INTO institute_settings (id, institute_name, code, address, phone, email, website, receipt_prefix, currency_symbol)
    VALUES (1, 'FeeFlow Institute of Technology & Management', 'FIT-MUM', '402 Knowledge Boulevard, Tech Campus, Mumbai - 400076', '+91 98765 43210', 'accounts@feeflow.edu', 'www.feeflow.edu', 'REC-2024-', '₹')
  `);

  // 2. Academic Years
  await connection.query(`
    INSERT INTO academic_years (id, name, start_date, end_date, is_current) VALUES
    (1, '2024-2025', '2024-07-01', '2025-06-30', 1),
    (2, '2025-2026', '2025-07-01', '2026-06-30', 0),
    (3, '2023-2024', '2023-07-01', '2024-06-30', 0)
  `);

  // 3. Courses
  await connection.query(`
    INSERT INTO courses (id, name, code) VALUES
    (1, 'B.Tech in Computer Science & Engineering', 'BTECH-CSE'),
    (2, 'B.Tech in Information Technology', 'BTECH-IT'),
    (3, 'B.Tech in Electronics & Telecommunication', 'BTECH-EXTC'),
    (4, 'Master of Business Administration', 'MBA'),
    (5, 'Bachelor of Computer Applications', 'BCA')
  `);

  // 4. Departments
  await connection.query(`
    INSERT INTO departments (id, name, code) VALUES
    (1, 'Department of Computer Engineering', 'DEPT-CSE'),
    (2, 'Department of Information Technology', 'DEPT-IT'),
    (3, 'Department of Electronics & Communication', 'DEPT-EXTC'),
    (4, 'Department of Management Studies', 'DEPT-MGMT')
  `);

  // 5. Fee Structures
  await connection.query(`
    INSERT INTO fee_structures (id, name, course_id, department_id, academic_year_id, tuition_fee, admission_fee, examination_fee, library_fee, laboratory_fee, sports_fee, other_fees, default_discount, default_scholarship) VALUES
    (1, 'B.Tech CSE Standard Structure', 1, 1, 1, 65000.00, 5000.00, 3000.00, 2500.00, 5000.00, 1500.00, 3000.00, 0.00, 0.00),
    (2, 'B.Tech IT Standard Structure', 2, 2, 1, 60000.00, 5000.00, 3000.00, 2500.00, 4500.00, 1500.00, 2500.00, 0.00, 0.00),
    (3, 'B.Tech EXTC Standard Structure', 3, 3, 1, 58000.00, 5000.00, 3000.00, 2500.00, 4000.00, 1500.00, 2000.00, 0.00, 0.00),
    (4, 'BCA Standard Structure', 5, 1, 1, 45000.00, 4000.00, 2500.00, 2000.00, 3500.00, 1000.00, 2000.00, 0.00, 0.00)
  `);

  // 6. Scholarships & Discounts
  await connection.query(`
    INSERT INTO scholarships (id, name, description, max_amount) VALUES
    (1, 'Merit Academic Scholarship', 'Granted to top rankers with above 90% in qualifying exams', 30000.00),
    (2, 'Sports Excellence Award', 'Granted to state and national level athletes', 20000.00),
    (3, 'Economically Weaker Section (EWS) Grant', 'Support for deserving students facing financial constraints', 25000.00)
  `);

  await connection.query(`
    INSERT INTO discounts (id, name, description, max_amount) VALUES
    (1, 'Early Bird Annual Concession', 'Discount for early upfront tuition payments', 5000.00),
    (2, 'Sibling Concession', 'Special concession for siblings studying in the same institute', 8000.00),
    (3, 'Staff Ward Concession', 'Concession for wards of faculty and institute staff', 15000.00)
  `);

  // 7. Admin User
  const adminPasswordHash = bcrypt.hashSync('admin123', 10);
  const [adminUser] = await connection.query(`
    INSERT INTO users (email, password_hash, role)
    VALUES ('admin@feeflow.edu', ?, 'admin')
  `, [adminPasswordHash]);

  await connection.query(`
    INSERT INTO admins (user_id, name, phone, is_super_admin)
    VALUES (?, 'Dr. Rajesh Sharma (Dean / Admin)', '+91 98200 12345', 1)
  `, [adminUser.insertId]);

  console.log('Admin user created: admin@feeflow.edu / admin123');

  // 8. Students
  const studentPasswordHash = bcrypt.hashSync('student123', 10);

  const studentList = [
    {
      name: 'Yash Bagrao',
      roll: 'CS2024001',
      email: 'yash.bagrao@feeflow.edu',
      phone: '9876543210',
      course_id: 1,
      dept_id: 1,
      year_id: 1,
      structure_id: 1,
      discount: 5000.00,
      scholarship: 0.00,
      paid: 80000.00
    },
    {
      name: 'Rahul Sharma',
      roll: 'CS2024002',
      email: 'rahul.sharma@feeflow.edu',
      phone: '9823456789',
      course_id: 1,
      dept_id: 1,
      year_id: 1,
      structure_id: 1,
      discount: 0.00,
      scholarship: 0.00,
      paid: 45000.00
    },
    {
      name: 'Priya Patil',
      roll: 'IT2024001',
      email: 'priya.patil@feeflow.edu',
      phone: '9812345678',
      course_id: 2,
      dept_id: 2,
      year_id: 1,
      structure_id: 2,
      discount: 0.00,
      scholarship: 20000.00,
      paid: 30000.00
    },
    {
      name: 'Aditya More',
      roll: 'EXTC2024001',
      email: 'aditya.more@feeflow.edu',
      phone: '9834567890',
      course_id: 3,
      dept_id: 3,
      year_id: 1,
      structure_id: 3,
      discount: 0.00,
      scholarship: 0.00,
      paid: 0.00
    },
    {
      name: 'Sneha Joshi',
      roll: 'BCA2024001',
      email: 'sneha.joshi@feeflow.edu',
      phone: '9845678901',
      course_id: 5,
      dept_id: 1,
      year_id: 1,
      structure_id: 4,
      discount: 0.00,
      scholarship: 0.00,
      paid: 0.00
    },
    {
      name: 'Rohan Kulkarni',
      roll: 'CS2024003',
      email: 'rohan.k@feeflow.edu',
      phone: '9856789012',
      course_id: 1,
      dept_id: 1,
      year_id: 1,
      structure_id: 1,
      discount: 0.00,
      scholarship: 0.00,
      paid: 85000.00
    }
  ];

  for (const s of studentList) {
    const [uResult] = await connection.query(`
      INSERT INTO users (email, password_hash, role)
      VALUES (?, ?, 'student')
    `, [s.email, studentPasswordHash]);

    const userId = uResult.insertId;

    const [sResult] = await connection.query(`
      INSERT INTO students (user_id, roll_number, name, email, phone, course_id, department_id, academic_year_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [userId, s.roll, s.name, s.email, s.phone, s.course_id, s.dept_id, s.year_id]);

    const studentId = sResult.insertId;

    const [structRows] = await connection.query(`SELECT * FROM fee_structures WHERE id = ?`, [s.structure_id]);
    const str = structRows[0];

    const totalFee = Number(str.tuition_fee) + Number(str.admission_fee) + Number(str.examination_fee) +
                     Number(str.library_fee) + Number(str.laboratory_fee) + Number(str.sports_fee) + Number(str.other_fees);
    const finalPayable = totalFee - s.discount - s.scholarship;

    const [sfResult] = await connection.query(`
      INSERT INTO student_fees (
        student_id, fee_structure_id, tuition_fee, admission_fee, examination_fee, library_fee,
        laboratory_fee, sports_fee, other_fees, discount_amount, scholarship_amount,
        total_fee, final_payable, paid_amount, academic_year_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      studentId, s.structure_id, str.tuition_fee, str.admission_fee, str.examination_fee, str.library_fee,
      str.laboratory_fee, str.sports_fee, str.other_fees, s.discount, s.scholarship,
      totalFee, finalPayable, s.paid, s.year_id
    ]);

    const studentFeeId = sfResult.insertId;

    const inst1Amount = Math.round(finalPayable / 2);
    const inst2Amount = finalPayable - inst1Amount;

    let inst1Paid = Math.min(s.paid, inst1Amount);
    let inst1Status = inst1Paid >= inst1Amount ? 'paid' : (inst1Paid > 0 ? 'partially_paid' : 'pending');

    let inst2Paid = Math.max(0, s.paid - inst1Amount);
    let inst2Status = inst2Paid >= inst2Amount ? 'paid' : (inst2Paid > 0 ? 'partially_paid' : (s.name === 'Sneha Joshi' ? 'overdue' : 'pending'));

    await connection.query(`
      INSERT INTO installments (student_fee_id, installment_number, amount, due_date, paid_amount, status) VALUES
      (?, 1, ?, '2024-09-15', ?, ?),
      (?, 2, ?, '2025-01-15', ?, ?)
    `, [
      studentFeeId, inst1Amount, inst1Paid, inst1Status,
      studentFeeId, inst2Amount, inst2Paid, inst2Status
    ]);

    if (s.name === 'Yash Bagrao') {
      const [p1] = await connection.query(`
        INSERT INTO payments (student_id, student_fee_id, amount, payment_method, transaction_id, payment_date, remarks, is_demo)
        VALUES (?, ?, 50000.00, 'upi', 'TXN_UPI_98213', '2024-08-10', 'Term 1 fee via UPI', 1)
      `, [studentId, studentFeeId]);

      await connection.query(`
        INSERT INTO receipts (payment_id, receipt_number, student_id, student_fee_id, amount_paid, remaining_balance, payment_date)
        VALUES (?, 'REC-2024-001', ?, ?, 50000.00, 30000.00, '2024-08-10')
      `, [p1.insertId, studentId, studentFeeId]);

      const [p2] = await connection.query(`
        INSERT INTO payments (student_id, student_fee_id, amount, payment_method, transaction_id, payment_date, remarks, is_demo)
        VALUES (?, ?, 30000.00, 'net_banking', 'TXN_NB_44120', '2024-11-05', 'Term 2 final settlement', 1)
      `, [studentId, studentFeeId]);

      await connection.query(`
        INSERT INTO receipts (payment_id, receipt_number, student_id, student_fee_id, amount_paid, remaining_balance, payment_date)
        VALUES (?, 'REC-2024-002', ?, ?, 30000.00, 0.00, '2024-11-05')
      `, [p2.insertId, studentId, studentFeeId]);
    } else if (s.name === 'Rahul Sharma') {
      const [p1] = await connection.query(`
        INSERT INTO payments (student_id, student_fee_id, amount, payment_method, transaction_id, payment_date, remarks, is_demo)
        VALUES (?, ?, 45000.00, 'card', 'TXN_CRD_11029', '2024-08-20', 'Installment 1 paid by Debit Card', 1)
      `, [studentId, studentFeeId]);

      await connection.query(`
        INSERT INTO receipts (payment_id, receipt_number, student_id, student_fee_id, amount_paid, remaining_balance, payment_date)
        VALUES (?, 'REC-2024-003', ?, ?, 45000.00, 40000.00, '2024-08-20')
      `, [p1.insertId, studentId, studentFeeId]);
    } else if (s.name === 'Priya Patil') {
      const [p1] = await connection.query(`
        INSERT INTO payments (student_id, student_fee_id, amount, payment_method, transaction_id, payment_date, remarks, is_demo)
        VALUES (?, ?, 30000.00, 'upi', 'TXN_UPI_77182', '2024-09-02', 'Part fee payment', 1)
      `, [studentId, studentFeeId]);

      await connection.query(`
        INSERT INTO receipts (payment_id, receipt_number, student_id, student_fee_id, amount_paid, remaining_balance, payment_date)
        VALUES (?, 'REC-2024-004', ?, ?, 30000.00, 29000.00, '2024-09-02')
      `, [p1.insertId, studentId, studentFeeId]);
    } else if (s.name === 'Rohan Kulkarni') {
      const [p1] = await connection.query(`
        INSERT INTO payments (student_id, student_fee_id, amount, payment_method, transaction_id, payment_date, remarks, is_demo)
        VALUES (?, ?, 85000.00, 'net_banking', 'TXN_NB_99211', '2024-08-15', 'Full annual payment via Net Banking', 1)
      `, [studentId, studentFeeId]);

      await connection.query(`
        INSERT INTO receipts (payment_id, receipt_number, student_id, student_fee_id, amount_paid, remaining_balance, payment_date)
        VALUES (?, 'REC-2024-005', ?, ?, 85000.00, 0.00, '2024-08-15')
      `, [p1.insertId, studentId, studentFeeId]);
    }
  }

  console.log('Seeded 6 students with varied payments and receipts.');
  await connection.end();
  console.log('Database seeding completed successfully!');
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
