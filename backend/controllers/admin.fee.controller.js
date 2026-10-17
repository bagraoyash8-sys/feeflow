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

exports.getFeeStructures = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        fs.*,
        c.name as course_name, c.code as course_code,
        d.name as department_name, d.code as department_code,
        ay.name as academic_year_name,
        (fs.tuition_fee + fs.admission_fee + fs.examination_fee + fs.library_fee + fs.laboratory_fee + fs.sports_fee + fs.other_fees) as calculated_total,
        (fs.tuition_fee + fs.admission_fee + fs.examination_fee + fs.library_fee + fs.laboratory_fee + fs.sports_fee + fs.other_fees - fs.default_discount - fs.default_scholarship) as calculated_payable
      FROM fee_structures fs
      LEFT JOIN courses c ON fs.course_id = c.id
      LEFT JOIN departments d ON fs.department_id = d.id
      LEFT JOIN academic_years ay ON fs.academic_year_id = ay.id
      ORDER BY fs.id DESC
    `);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve fee structures' });
  }
};

exports.createFeeStructure = async (req, res) => {
  try {
    const {
      name, course_id, department_id, academic_year_id,
      tuition_fee, admission_fee, examination_fee, library_fee,
      laboratory_fee, sports_fee, other_fees, default_discount, default_scholarship
    } = req.body;

    if (!course_id || !department_id || !academic_year_id) {
      return res.status(400).json({ success: false, error: 'Course, Department, and Academic Year are required' });
    }

    const [result] = await pool.query(`
      INSERT INTO fee_structures (
        name, course_id, department_id, academic_year_id,
        tuition_fee, admission_fee, examination_fee, library_fee,
        laboratory_fee, sports_fee, other_fees, default_discount, default_scholarship
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name || 'Standard Fee Structure',
      course_id, department_id, academic_year_id,
      tuition_fee || 0, admission_fee || 0, examination_fee || 0, library_fee || 0,
      laboratory_fee || 0, sports_fee || 0, other_fees || 0, default_discount || 0, default_scholarship || 0
    ]);

    return res.status(201).json({ success: true, message: 'Fee structure created successfully', data: { id: result.insertId } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to create fee structure' });
  }
};

exports.updateFeeStructure = async (req, res) => {
  try {
    const id = req.params.id;
    const {
      name, course_id, department_id, academic_year_id,
      tuition_fee, admission_fee, examination_fee, library_fee,
      laboratory_fee, sports_fee, other_fees, default_discount, default_scholarship
    } = req.body;

    await pool.query(`
      UPDATE fee_structures SET
        name = COALESCE(?, name),
        course_id = COALESCE(?, course_id),
        department_id = COALESCE(?, department_id),
        academic_year_id = COALESCE(?, academic_year_id),
        tuition_fee = COALESCE(?, tuition_fee),
        admission_fee = COALESCE(?, admission_fee),
        examination_fee = COALESCE(?, examination_fee),
        library_fee = COALESCE(?, library_fee),
        laboratory_fee = COALESCE(?, laboratory_fee),
        sports_fee = COALESCE(?, sports_fee),
        other_fees = COALESCE(?, other_fees),
        default_discount = COALESCE(?, default_discount),
        default_scholarship = COALESCE(?, default_scholarship)
      WHERE id = ?
    `, [
      name, course_id, department_id, academic_year_id,
      tuition_fee, admission_fee, examination_fee, library_fee,
      laboratory_fee, sports_fee, other_fees, default_discount, default_scholarship,
      id
    ]);

    return res.json({ success: true, message: 'Fee structure updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update fee structure' });
  }
};

exports.assignStudentFee = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const {
      student_id, fee_structure_id, tuition_fee, admission_fee, examination_fee,
      library_fee, laboratory_fee, sports_fee, other_fees,
      discount_amount, scholarship_amount, installment_count
    } = req.body;

    if (!student_id || !fee_structure_id) {
      return res.status(400).json({ success: false, error: 'Student and Fee Structure must be specified' });
    }

    const t = Number(tuition_fee || 0);
    const a = Number(admission_fee || 0);
    const e = Number(examination_fee || 0);
    const l = Number(library_fee || 0);
    const lab = Number(laboratory_fee || 0);
    const s = Number(sports_fee || 0);
    const o = Number(other_fees || 0);
    const disc = Number(discount_amount || 0);
    const schol = Number(scholarship_amount || 0);

    const totalFee = t + a + e + l + lab + s + o;
    const finalPayable = Math.max(0, totalFee - disc - schol);

    const [existing] = await connection.query('SELECT id, paid_amount FROM student_fees WHERE student_id = ?', [student_id]);
    let studentFeeId;
    let paidAmount = 0;

    if (existing.length > 0) {
      studentFeeId = existing[0].id;
      paidAmount = Number(existing[0].paid_amount);

      await connection.query(`
        UPDATE student_fees SET
          fee_structure_id = ?, tuition_fee = ?, admission_fee = ?, examination_fee = ?,
          library_fee = ?, laboratory_fee = ?, sports_fee = ?, other_fees = ?,
          discount_amount = ?, scholarship_amount = ?, total_fee = ?, final_payable = ?
        WHERE id = ?
      `, [fee_structure_id, t, a, e, l, lab, s, o, disc, schol, totalFee, finalPayable, studentFeeId]);

      await connection.query('DELETE FROM installments WHERE student_fee_id = ? AND paid_amount = 0', [studentFeeId]);
    } else {
      const [sfRes] = await connection.query(`
        INSERT INTO student_fees (
          student_id, fee_structure_id, tuition_fee, admission_fee, examination_fee,
          library_fee, laboratory_fee, sports_fee, other_fees, discount_amount,
          scholarship_amount, total_fee, final_payable, paid_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00)
      `, [student_id, fee_structure_id, t, a, e, l, lab, s, o, disc, schol, totalFee, finalPayable]);
      studentFeeId = sfRes.insertId;
    }

    const count = parseInt(installment_count) || 2;
    const remainingToSchedule = Math.max(0, finalPayable - paidAmount);
    if (remainingToSchedule > 0) {
      const perInst = Math.round(remainingToSchedule / count);
      for (let i = 1; i <= count; i++) {
        const instAmt = (i === count) ? (remainingToSchedule - (perInst * (count - 1))) : perInst;
        const days = i * 45;
        await connection.query(`
          INSERT INTO installments (student_fee_id, installment_number, amount, due_date, paid_amount, status)
          VALUES (?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), 0.00, 'pending')
        `, [studentFeeId, i, instAmt, days]);
      }
    }

    await connection.commit();
    return res.json({ success: true, message: 'Fee assigned successfully', data: { studentFeeId } });
  } catch (err) {
    await connection.rollback();
    return res.status(500).json({ success: false, error: 'Failed to assign fee' });
  } finally {
    connection.release();
  }
};

exports.recordPayment = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { student_id, amount, payment_method, transaction_id, remarks } = req.body;
    const payAmount = parseFloat(amount);

    if (!student_id || isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid student and positive payment amount are required' });
    }
    if (!['cash', 'upi', 'card', 'net_banking'].includes(payment_method)) {
      return res.status(400).json({ success: false, error: 'Invalid payment method selected' });
    }

    const [feeRows] = await connection.query(
      'SELECT * FROM student_fees WHERE student_id = ? ORDER BY id DESC LIMIT 1',
      [student_id]
    );

    if (feeRows.length === 0) {
      return res.status(400).json({ success: false, error: 'No fee structure assigned to this student yet' });
    }

    const sf = feeRows[0];
    const currentPaid = Number(sf.paid_amount);
    const finalPayable = Number(sf.final_payable);
    const currentPending = finalPayable - currentPaid;

    if (payAmount > currentPending + 0.01) {
      return res.status(400).json({
        success: false,
        error: `Payment amount (${payAmount}) exceeds remaining balance (${currentPending})`
      });
    }

    const newPaid = currentPaid + payAmount;
    const newRemaining = Math.max(0, finalPayable - newPaid);
    const txnId = transaction_id ? transaction_id.trim() : `TXN_MANUAL_${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];

    const [paymentRes] = await connection.query(`
      INSERT INTO payments (
        student_id, student_fee_id, amount, payment_method, transaction_id,
        payment_date, remarks, created_by, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [
      student_id, sf.id, payAmount, payment_method, txnId,
      today, remarks || 'Fee collected by admin', req.user ? req.user.id : null
    ]);

    const paymentId = paymentRes.insertId;
    await connection.query('UPDATE student_fees SET paid_amount = ? WHERE id = ?', [newPaid, sf.id]);

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

    const receiptNumber = await generateReceiptNumber();
    const [receiptRes] = await connection.query(`
      INSERT INTO receipts (
        payment_id, receipt_number, student_id, student_fee_id,
        amount_paid, remaining_balance, payment_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [paymentId, receiptNumber, student_id, sf.id, payAmount, newRemaining, today]);

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
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
    return res.status(500).json({ success: false, error: 'Payment recording failed' });
  } finally {
    connection.release();
  }
};

exports.getPayments = async (req, res) => {
  try {
    const { student_id, payment_method, start_date, end_date } = req.query;
    let query = `
      SELECT 
        p.*,
        s.name as student_name, s.roll_number,
        c.name as course_name, c.code as course_code,
        r.id as receipt_id, r.receipt_number
      FROM payments p
      JOIN students s ON p.student_id = s.id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN receipts r ON r.payment_id = p.id
      WHERE 1=1
    `;
    const params = [];
    if (student_id) { query += ` AND p.student_id = ?`; params.push(student_id); }
    if (payment_method) { query += ` AND p.payment_method = ?`; params.push(payment_method); }
    if (start_date) { query += ` AND p.payment_date >= ?`; params.push(start_date); }
    if (end_date) { query += ` AND p.payment_date <= ?`; params.push(end_date); }

    query += ` ORDER BY p.id DESC`;
    const [rows] = await pool.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve payments' });
  }
};

exports.getInstallments = async (req, res) => {
  try {
    const { status, student_id } = req.query;
    let query = `
      SELECT 
        i.*,
        s.id as student_id, s.name as student_name, s.roll_number,
        c.name as course_name,
        sf.final_payable, sf.paid_amount as total_student_paid
      FROM installments i
      JOIN student_fees sf ON i.student_fee_id = sf.id
      JOIN students s ON sf.student_id = s.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { query += ` AND i.status = ?`; params.push(status); }
    if (student_id) { query += ` AND s.id = ?`; params.push(student_id); }

    query += ` ORDER BY i.due_date ASC`;
    const [rows] = await pool.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve installments' });
  }
};

exports.getReceipts = async (req, res) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT 
        r.*,
        s.name as student_name, s.roll_number, s.email as student_email,
        c.name as course_name, c.code as course_code,
        p.payment_method, p.transaction_id
      FROM receipts r
      JOIN students s ON r.student_id = s.id
      LEFT JOIN courses c ON s.course_id = c.id
      JOIN payments p ON r.payment_id = p.id
      WHERE 1=1
    `;
    const params = [];
    if (search && search.trim() !== '') {
      query += ` AND (r.receipt_number LIKE ? OR s.name LIKE ? OR s.roll_number LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }
    query += ` ORDER BY r.id DESC`;
    const [rows] = await pool.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve receipts' });
  }
};

exports.getReceiptById = async (req, res) => {
  try {
    const id = req.params.id;
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
      WHERE r.id = ? OR r.receipt_number = ?
    `, [id, id]);

    if (receiptRows.length === 0) return res.status(404).json({ success: false, error: 'Receipt not found' });
    const [settings] = await pool.query('SELECT * FROM institute_settings WHERE id = 1');

    return res.json({
      success: true,
      data: {
        receipt: receiptRows[0],
        institute: settings[0] || {}
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to load receipt' });
  }
};

exports.getDiscountsScholarships = async (req, res) => {
  try {
    const [discounts] = await pool.query('SELECT * FROM discounts ORDER BY id ASC');
    const [scholarships] = await pool.query('SELECT * FROM scholarships ORDER BY id ASC');
    return res.json({ success: true, data: { discounts, scholarships } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to load discounts/scholarships' });
  }
};

exports.createDiscount = async (req, res) => {
  try {
    const { name, description, max_amount } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
    const [resRow] = await pool.query('INSERT INTO discounts (name, description, max_amount) VALUES (?, ?, ?)', [
      name.trim(), description || '', max_amount || 0
    ]);
    return res.status(201).json({ success: true, message: 'Discount added', data: { id: resRow.insertId } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to create discount' });
  }
};

exports.createScholarship = async (req, res) => {
  try {
    const { name, description, max_amount } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
    const [resRow] = await pool.query('INSERT INTO scholarships (name, description, max_amount) VALUES (?, ?, ?)', [
      name.trim(), description || '', max_amount || 0
    ]);
    return res.status(201).json({ success: true, message: 'Scholarship added', data: { id: resRow.insertId } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to create scholarship' });
  }
};

exports.deleteDiscount = async (req, res) => {
  try {
    await pool.query('DELETE FROM discounts WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Discount deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to delete discount' });
  }
};

exports.deleteScholarship = async (req, res) => {
  try {
    await pool.query('DELETE FROM scholarships WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Scholarship deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to delete scholarship' });
  }
};
