const pool = require('../config/db');

exports.getDailyReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let query = `
      SELECT 
        DATE(p.payment_date) as report_date,
        COUNT(p.id) as transaction_count,
        SUM(p.amount) as total_collected,
        SUM(CASE WHEN p.payment_method = 'cash' THEN p.amount ELSE 0 END) as cash_collected,
        SUM(CASE WHEN p.payment_method = 'upi' THEN p.amount ELSE 0 END) as upi_collected,
        SUM(CASE WHEN p.payment_method = 'card' THEN p.amount ELSE 0 END) as card_collected,
        SUM(CASE WHEN p.payment_method = 'net_banking' THEN p.amount ELSE 0 END) as net_banking_collected
      FROM payments p
      WHERE 1=1
    `;
    const params = [];
    if (start_date) { query += ' AND p.payment_date >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND p.payment_date <= ?'; params.push(end_date); }

    query += ' GROUP BY report_date ORDER BY report_date DESC';
    const [rows] = await pool.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch daily report' });
  }
};

exports.getMonthlyReport = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        DATE_FORMAT(p.payment_date, '%M %Y') as month_name,
        DATE_FORMAT(p.payment_date, '%Y-%m') as sort_key,
        COUNT(p.id) as transaction_count,
        SUM(p.amount) as total_collected,
        SUM(CASE WHEN p.payment_method = 'cash' THEN p.amount ELSE 0 END) as cash_collected,
        SUM(CASE WHEN p.payment_method = 'upi' THEN p.amount ELSE 0 END) as upi_collected,
        SUM(CASE WHEN p.payment_method = 'card' THEN p.amount ELSE 0 END) as card_collected,
        SUM(CASE WHEN p.payment_method = 'net_banking' THEN p.amount ELSE 0 END) as net_banking_collected
      FROM payments p
      GROUP BY sort_key, month_name
      ORDER BY sort_key DESC
    `);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch monthly report' });
  }
};

exports.getYearlyReport = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        YEAR(p.payment_date) as year,
        COUNT(p.id) as transaction_count,
        SUM(p.amount) as total_collected
      FROM payments p
      GROUP BY year
      ORDER BY year DESC
    `);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch yearly report' });
  }
};

exports.getStudentWiseReport = async (req, res) => {
  try {
    const { course_id, department_id, academic_year_id } = req.query;
    let query = `
      SELECT 
        s.id, s.roll_number, s.name, s.email, s.phone,
        c.name as course_name, d.name as department_name, ay.name as academic_year_name,
        COALESCE(sf.total_fee, 0) as total_fee,
        COALESCE(sf.discount_amount, 0) as discount_amount,
        COALESCE(sf.scholarship_amount, 0) as scholarship_amount,
        COALESCE(sf.final_payable, 0) as final_payable,
        COALESCE(sf.paid_amount, 0) as paid_amount,
        COALESCE(sf.final_payable - sf.paid_amount, 0) as balance_due,
        CASE 
          WHEN COALESCE(sf.paid_amount, 0) >= COALESCE(sf.final_payable, 0) THEN 'Paid'
          WHEN COALESCE(sf.paid_amount, 0) > 0 THEN 'Partially Paid'
          ELSE 'Pending'
        END as payment_status
      FROM students s
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
      LEFT JOIN student_fees sf ON sf.student_id = s.id
      WHERE s.status = 'active'
    `;
    const params = [];
    if (course_id) { query += ' AND s.course_id = ?'; params.push(course_id); }
    if (department_id) { query += ' AND s.department_id = ?'; params.push(department_id); }
    if (academic_year_id) { query += ' AND s.academic_year_id = ?'; params.push(academic_year_id); }

    query += ' ORDER BY s.name ASC';
    const [rows] = await pool.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch student-wise report' });
  }
};

exports.getPendingFeeReport = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        s.id, s.roll_number, s.name, s.email, s.phone,
        c.name as course_name, d.name as department_name,
        sf.final_payable, sf.paid_amount, (sf.final_payable - sf.paid_amount) as pending_amount
      FROM students s
      JOIN student_fees sf ON sf.student_id = s.id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE s.status = 'active' AND sf.paid_amount < sf.final_payable
      ORDER BY pending_amount DESC
    `);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch pending fees' });
  }
};

exports.getOverdueReport = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        i.id as installment_id, i.installment_number, i.amount as installment_amount,
        i.paid_amount as installment_paid, (i.amount - i.paid_amount) as overdue_amount,
        i.due_date,
        s.id as student_id, s.name as student_name, s.roll_number, s.phone, s.email,
        c.name as course_name
      FROM installments i
      JOIN student_fees sf ON i.student_fee_id = sf.id
      JOIN students s ON sf.student_id = s.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE (i.status = 'overdue' OR (i.due_date < CURDATE() AND i.paid_amount < i.amount))
      ORDER BY i.due_date ASC
    `);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch overdue report' });
  }
};

exports.getDepartmentWiseReport = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        COALESCE(d.name, 'No Department Assigned') as department_name,
        COALESCE(d.code, 'N/A') as department_code,
        COUNT(DISTINCT s.id) as student_count,
        COALESCE(SUM(sf.final_payable), 0) as total_payable,
        COALESCE(SUM(sf.paid_amount), 0) as total_collected,
        COALESCE(SUM(sf.final_payable - sf.paid_amount), 0) as total_pending
      FROM departments d
      LEFT JOIN students s ON s.department_id = d.id AND s.status = 'active'
      LEFT JOIN student_fees sf ON sf.student_id = s.id
      GROUP BY d.id, d.name, d.code
    `);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch department report' });
  }
};

exports.getPaymentMethodReport = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        payment_method,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM payments
      GROUP BY payment_method
    `);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch payment method report' });
  }
};
