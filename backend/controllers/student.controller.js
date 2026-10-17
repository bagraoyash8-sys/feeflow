const pool = require('../config/db');

const generateReceiptNumber = async () => {
  const [settings] = await pool.query('SELECT receipt_prefix FROM institute_settings WHERE id = 1');
  const prefix = (settings.length > 0 && settings[0].receipt_prefix) ? settings[0].receipt_prefix : 'REC-';
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const [countRows] = await pool.query('SELECT COUNT(*) as total FROM receipts');
  const nextSeq = String(countRows[0].total + 1).padStart(4, '0');
  return `${prefix}${year}-${nextSeq}-${randomSuffix}`;
};

// 1. Student Dashboard
exports.getDashboard = async (req, res) => {
  try {
    const studentId = req.student.id;

    // Assigned Fee
    const [feeRows] = await pool.query(`
      SELECT sf.*, fs.name as fee_structure_name
      FROM student_fees sf
      LEFT JOIN fee_structures fs ON sf.fee_structure_id = fs.id
      WHERE sf.student_id = ?
      ORDER BY sf.id DESC LIMIT 1
    `, [studentId]);

    const fee = feeRows.length > 0 ? feeRows[0] : null;
    const totalFee = fee ? Number(fee.final_payable) : 0;
    const amountPaid = fee ? Number(fee.paid_amount) : 0;
    const pendingAmount = Math.max(0, totalFee - amountPaid);

    // Next Due Date from pending installments
    let nextDueDate = null;
    let nextDueAmount = 0;
    if (fee) {
      const [nextInst] = await pool.query(`
        SELECT due_date, (amount - paid_amount) as due_amount
        FROM installments
        WHERE student_fee_id = ? AND paid_amount < amount
        ORDER BY due_date ASC LIMIT 1
      `, [fee.id]);

      if (nextInst.length > 0) {
        nextDueDate = nextInst[0].due_date;
        nextDueAmount = Number(nextInst[0].due_amount);
      }
    }

    // Recent Payments
    const [recentPayments] = await pool.query(`
      SELECT p.*, r.id as receipt_id, r.receipt_number
      FROM payments p
      LEFT JOIN receipts r ON r.payment_id = p.id
      WHERE p.student_id = ?
      ORDER BY p.id DESC LIMIT 5
    `, [studentId]);

    return res.json({
      success: true,
      data: {
        summary: {
          totalFee,
          amountPaid,
          pendingAmount,
          nextDueDate,
          nextDueAmount,
          paymentStatus: pendingAmount === 0 && totalFee > 0 ? 'Fully Paid' : (amountPaid > 0 ? 'Partially Paid' : 'Unpaid')
        },
        student: req.student,
        recentPayments
      }
    });
  } catch (err) {
    console.error('Student dashboard error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load student dashboard' });
  }
};

// 2. My Fees Breakdown
exports.getFees = async (req, res) => {
  try {
    const studentId = req.student.id;

    const [feeRows] = await pool.query(`
      SELECT 
        sf.*, 
        fs.name as fee_structure_name,
        c.name as course_name,
        d.name as department_name,
        ay.name as academic_year_name
      FROM student_fees sf
      LEFT JOIN fee_structures fs ON sf.fee_structure_id = fs.id
      JOIN students s ON sf.student_id = s.id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN academic_years ay ON sf.academic_year_id = ay.id
      WHERE sf.student_id = ?
      ORDER BY sf.id DESC LIMIT 1
    `, [studentId]);

    if (feeRows.length === 0) {
      return res.json({ success: true, data: { fee: null, installments: [] } });
    }

    const fee = feeRows[0];
    const [installments] = await pool.query(`
      SELECT * FROM installments
      WHERE student_fee_id = ?
      ORDER BY installment_number ASC
    `, [fee.id]);

    return res.json({
      success: true,
      data: {
        fee,
        installments
      }
    });
  } catch (err) {
    console.error('getFees error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load fee breakdown' });
  }
};

// 3. Payment History
exports.getPayments = async (req, res) => {
  try {
    const studentId = req.student.id;
    const [payments] = await pool.query(`
      SELECT p.*, r.id as receipt_id, r.receipt_number
      FROM payments p
      LEFT JOIN receipts r ON r.payment_id = p.id
      WHERE p.student_id = ?
      ORDER BY p.id DESC
    `, [studentId]);

    return res.json({ success: true, data: payments });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to load payment history' });
  }
};

// 4. My Receipts
exports.getReceipts = async (req, res) => {
  try {
    const studentId = req.student.id;
    const [receipts] = await pool.query(`
      SELECT r.*, p.payment_method, p.transaction_id, p.remarks
      FROM receipts r
      JOIN payments p ON r.payment_id = p.id
      WHERE r.student_id = ?
      ORDER BY r.id DESC
    `, [studentId]);

    return res.json({ success: true, data: receipts });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to load receipts' });
  }
};

exports.getReceiptById = async (req, res) => {
  try {
    const studentId = req.student.id;
    const receiptId = req.params.id;

    const [receiptRows] = await pool.query(`
      SELECT 
        r.*,
        p.payment_method, p.transaction_id, p.remarks, p.created_at as payment_timestamp,
        s.name as student_name, s.roll_number, s.email as student_email, s.phone as student_phone,
        c.name as course_name, c.code as course_code,
        d.name as department_name,
        ay.name as academic_year_name,
        sf.tuition_fee, sf.admission_fee, sf.examination_fee, sf.library_fee,
        sf.laboratory_fee, sf.sports_fee, sf.other_fees, sf.discount_amount,
        sf.scholarship_amount, sf.total_fee, sf.final_payable, sf.paid_amount as total_paid_to_date
      FROM receipts r
      JOIN payments p ON r.payment_id = p.id
      JOIN students s ON r.student_id = s.id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
      JOIN student_fees sf ON r.student_fee_id = sf.id
      WHERE (r.id = ? OR r.receipt_number = ?) AND r.student_id = ?
    `, [receiptId, receiptId, studentId]);

    if (receiptRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Receipt not found' });
    }

    const [settings] = await pool.query('SELECT * FROM institute_settings WHERE id = 1');

    return res.json({
      success: true,
      data: {
        receipt: receiptRows[0],
        institute: settings[0] || {}
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve receipt' });
  }
};

// 5. Demo Online Payment
exports.processDemoPayment = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const studentId = req.student.id;
    const { amount, payment_method, transaction_id, remarks } = req.body;
    const payAmount = parseFloat(amount);

    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Please enter a valid payment amount' });
    }

    if (!['upi', 'card', 'net_banking'].includes(payment_method)) {
      return res.status(400).json({ success: false, error: 'Please select a valid payment method' });
    }

    // Get current student fee record
    const [feeRows] = await connection.query(
      'SELECT * FROM student_fees WHERE student_id = ? ORDER BY id DESC LIMIT 1',
      [studentId]
    );

    if (feeRows.length === 0) {
      return res.status(400).json({ success: false, error: 'No fee record assigned' });
    }

    const sf = feeRows[0];
    const currentPaid = Number(sf.paid_amount);
    const finalPayable = Number(sf.final_payable);
    const currentPending = finalPayable - currentPaid;

    if (payAmount > currentPending + 0.01) {
      return res.status(400).json({
        success: false,
        error: `Payment amount cannot exceed remaining balance of ₹${currentPending}`
      });
    }

    const newPaid = currentPaid + payAmount;
    const newRemaining = Math.max(0, finalPayable - newPaid);
    const txnId = transaction_id ? transaction_id.trim() : `DEMO_TXN_${Date.now()}_${Math.floor(Math.random() * 9000 + 1000)}`;
    const today = new Date().toISOString().split('T')[0];

    // 1. Create Payment record
    const [paymentRes] = await connection.query(`
      INSERT INTO payments (
        student_id, student_fee_id, amount, payment_method, transaction_id,
        payment_date, remarks, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `, [studentId, sf.id, payAmount, payment_method, txnId, today, remarks || 'Online Demo Payment by Student']);

    const paymentId = paymentRes.insertId;

    // 2. Update Student Fee Record
    await connection.query('UPDATE student_fees SET paid_amount = ? WHERE id = ?', [newPaid, sf.id]);

    // 3. Update Installments sequentially
    let unallocated = payAmount;
    const [instRows] = await connection.query(
      'SELECT * FROM installments WHERE student_fee_id = ? AND paid_amount < amount ORDER BY installment_number ASC',
      [sf.id]
    );

    for (const inst of instRows) {
      if (unallocated <= 0) break;
      const instDue = Number(inst.amount) - Number(inst.paid_amount);
      const alloc = Math.min(unallocated, instDue);
      const updatedInstPaid = Number(inst.paid_amount) + alloc;
      const updatedStatus = (updatedInstPaid >= Number(inst.amount)) ? 'paid' : 'partially_paid';

      await connection.query(
        'UPDATE installments SET paid_amount = ?, status = ? WHERE id = ?',
        [updatedInstPaid, updatedStatus, inst.id]
      );
      unallocated -= alloc;
    }

    // 4. Generate Receipt
    const receiptNumber = await generateReceiptNumber();
    const [receiptRes] = await connection.query(`
      INSERT INTO receipts (
        payment_id, receipt_number, student_id, student_fee_id,
        amount_paid, remaining_balance, payment_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [paymentId, receiptNumber, studentId, sf.id, payAmount, newRemaining, today]);

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Demo payment completed successfully! Receipt generated.',
      data: {
        paymentId,
        receiptId: receiptRes.insertId,
        receiptNumber,
        amountPaid: payAmount,
        remainingBalance: newRemaining
      }
    });
  } catch (err) {
    await connection.rollback();
    console.error('processDemoPayment error:', err);
    return res.status(500).json({ success: false, error: 'Demo payment processing failed' });
  } finally {
    connection.release();
  }
};

// 6. Student Profile
exports.getProfile = async (req, res) => {
  try {
    const studentId = req.student.id;
    const [rows] = await pool.query(`
      SELECT 
        s.*,
        c.name as course_name, c.code as course_code,
        d.name as department_name, d.code as department_code,
        ay.name as academic_year_name,
        u.email as user_email
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
      WHERE s.id = ?
    `, [studentId]);

    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Student not found' });
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch student profile' });
  }
};
