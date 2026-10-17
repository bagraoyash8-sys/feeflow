-- FeeFlow Database Schema
CREATE DATABASE IF NOT EXISTS feeflow;
USE feeflow;

-- Users table (Authentication)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'student') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Admin Profiles
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  is_super_admin TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Academic Years
CREATE TABLE IF NOT EXISTS academic_years (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  start_date DATE,
  end_date DATE,
  is_current TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Students
CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  roll_number VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(191) NOT NULL,
  phone VARCHAR(20),
  course_id INT,
  department_id INT,
  academic_year_id INT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL
);

-- Fee Structure Templates
CREATE TABLE IF NOT EXISTS fee_structures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) DEFAULT 'Standard Fee Structure',
  course_id INT,
  department_id INT,
  academic_year_id INT,
  tuition_fee DECIMAL(10,2) DEFAULT 0.00,
  admission_fee DECIMAL(10,2) DEFAULT 0.00,
  examination_fee DECIMAL(10,2) DEFAULT 0.00,
  library_fee DECIMAL(10,2) DEFAULT 0.00,
  laboratory_fee DECIMAL(10,2) DEFAULT 0.00,
  sports_fee DECIMAL(10,2) DEFAULT 0.00,
  other_fees DECIMAL(10,2) DEFAULT 0.00,
  default_discount DECIMAL(10,2) DEFAULT 0.00,
  default_scholarship DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE
);

-- Student Assigned Fees
CREATE TABLE IF NOT EXISTS student_fees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  fee_structure_id INT,
  tuition_fee DECIMAL(10,2) DEFAULT 0.00,
  admission_fee DECIMAL(10,2) DEFAULT 0.00,
  examination_fee DECIMAL(10,2) DEFAULT 0.00,
  library_fee DECIMAL(10,2) DEFAULT 0.00,
  laboratory_fee DECIMAL(10,2) DEFAULT 0.00,
  sports_fee DECIMAL(10,2) DEFAULT 0.00,
  other_fees DECIMAL(10,2) DEFAULT 0.00,
  discount_amount DECIMAL(10,2) DEFAULT 0.00,
  scholarship_amount DECIMAL(10,2) DEFAULT 0.00,
  total_fee DECIMAL(10,2) DEFAULT 0.00,
  final_payable DECIMAL(10,2) DEFAULT 0.00,
  paid_amount DECIMAL(10,2) DEFAULT 0.00,
  academic_year_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (fee_structure_id) REFERENCES fee_structures(id) ON DELETE SET NULL,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  student_fee_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method ENUM('cash', 'upi', 'card', 'net_banking') NOT NULL,
  transaction_id VARCHAR(100),
  payment_date DATE,
  remarks TEXT,
  created_by INT,
  is_demo TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE CASCADE
);

-- Installments
CREATE TABLE IF NOT EXISTS installments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_fee_id INT NOT NULL,
  installment_number INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE,
  paid_amount DECIMAL(10,2) DEFAULT 0.00,
  status ENUM('pending', 'partially_paid', 'paid', 'overdue') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE CASCADE
);

-- Scholarships
CREATE TABLE IF NOT EXISTS scholarships (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  max_amount DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Discounts
CREATE TABLE IF NOT EXISTS discounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  max_amount DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Receipts
CREATE TABLE IF NOT EXISTS receipts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_id INT NOT NULL,
  receipt_number VARCHAR(50) NOT NULL UNIQUE,
  student_id INT NOT NULL,
  student_fee_id INT NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL,
  remaining_balance DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE CASCADE
);

-- Institute Settings
CREATE TABLE IF NOT EXISTS institute_settings (
  id INT PRIMARY KEY DEFAULT 1,
  institute_name VARCHAR(150) DEFAULT 'FeeFlow Institute of Technology',
  code VARCHAR(50) DEFAULT 'FIT-2026',
  address VARCHAR(255) DEFAULT '402 Knowledge Boulevard, Tech Campus, Mumbai - 400076',
  phone VARCHAR(50) DEFAULT '+91 98765 43210',
  email VARCHAR(100) DEFAULT 'accounts@feeflow.edu',
  website VARCHAR(100) DEFAULT 'www.feeflow.edu',
  receipt_prefix VARCHAR(20) DEFAULT 'REC-',
  logo_url VARCHAR(255) DEFAULT '',
  currency_symbol VARCHAR(10) DEFAULT '₹',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
