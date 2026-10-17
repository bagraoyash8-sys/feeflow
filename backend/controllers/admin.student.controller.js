const bcrypt = require('bcryptjs');
const pool = require('../config/db');

exports.getStudents = async (req, res) => {
  try {
    const { search, course_id, department_id, academic_year_id, status, sort } = req.query;

    let query = `
      SELECT 
        s.id, s.roll_number, s.name, s.email, s.phone, s.status, s.created_at,
        c.id as course_id, c.name as course_name, c.code as course_code,
        d.id as department_id, d.name as department_name, d.code as department_code,
        ay.id as academic_year_id, ay.name as academic_year_name,
        COALESCE(sf.total_fee, 0) as total_fee,
        COALESCE(sf.discount_amount, 0) as discount_amount,
        COALESCE(sf.scholarship_amount, 0) as scholarship_amount,
        COALESCE(sf.final_payable, 0) as final_payable,
        COALESCE(sf.paid_amount, 0) as paid_amount,
        COALESCE(sf.final_payable - sf.paid_amount, 0) as pending_amount,
        sf.id as student_fee_id
      FROM students s
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
      LEFT JOIN student_fees sf ON sf.student_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim() !== '') {
      query += ` AND (s.name LIKE ? OR s.roll_number LIKE ? OR s.email LIKE ? OR s.phone LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }
    if (course_id) { query += ` AND s.course_id = ?`; params.push(course_id); }
    if (department_id) { query += ` AND s.department_id = ?`; params.push(department_id); }
    if (academic_year_id) { query += ` AND s.academic_year_id = ?`; params.push(academic_year_id); }
    if (status) { query += ` AND s.status = ?`; params.push(status); }

    if (sort === 'name_asc') query += ` ORDER BY s.name ASC`;
    else if (sort === 'name_desc') query += ` ORDER BY s.name DESC`;
    else if (sort === 'pending_desc') query += ` ORDER BY pending_amount DESC`;
    else if (sort === 'roll_asc') query += ` ORDER BY s.roll_number ASC`;
    else query += ` ORDER BY s.id DESC`;

    const [rows] = await pool.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getStudents error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve students' });
  }
};

exports.createStudent = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      name, email, phone, roll_number, course_id, department_id, academic_year_id,
      password, fee_structure_id, discount_amount, scholarship_amount
    } = req.body;

    if (!name || !email || !roll_number) {
      return res.status(400).json({ success: false, error: 'Name, email, and roll number are required fields' });
    }
    if (/\d/.test(name)) {
      return res.status(400).json({ success: false, error: 'Name must not contain numbers' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address format' });
    }
    if (phone && !/^\d{10}$/.test(phone.replace(/\D/g, ''))) {
      return res.status(400).json({ success: false, error: 'Phone number must be a 10-digit number' });
    }

    const [existing] = await connection.query(
      'SELECT id FROM students WHERE roll_number = ? OR email = ?',
      [roll_number.trim(), email.trim()]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Student with this roll number or email already exists' });
    }

    const plainPass = password || 'student123';
    const passwordHash = await bcrypt.hash(plainPass, 10);
    const [userRes] = await connection.query(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, "student")',
      [email.trim(), passwordHash]
    );

    const [studentRes] = await connection.query(`
      INSERT INTO students (user_id, roll_number, name, email, phone, course_id, department_id, academic_year_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [
      userRes.insertId, roll_number.trim(), name.trim(), email.trim(),
      phone ? phone.trim() : null, course_id || null, department_id || null,
      academic_year_id || null
    ]);

    const studentId = studentRes.insertId;

    if (fee_structure_id) {
      const [structRows] = await connection.query('SELECT * FROM fee_structures WHERE id = ?', [fee_structure_id]);
      if (structRows.length > 0) {
        const str = structRows[0];
        const disc = Number(discount_amount || 0);
        const schol = Number(scholarship_amount || 0);
        const totalFee = Number(str.tuition_fee) + Number(str.admission_fee) + Number(str.examination_fee) +
                         Number(str.library_fee) + Number(str.laboratory_fee) + Number(str.sports_fee) + Number(str.other_fees);
        const finalPayable = Math.max(0, totalFee - disc - schol);

        const [sfRes] = await connection.query(`
          INSERT INTO student_fees (
            student_id, fee_structure_id, tuition_fee, admission_fee, examination_fee,
            library_fee, laboratory_fee, sports_fee, other_fees, discount_amount,
            scholarship_amount, total_fee, final_payable, paid_amount, academic_year_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?)
        `, [
          studentId, str.id, str.tuition_fee, str.admission_fee, str.examination_fee,
          str.library_fee, str.laboratory_fee, str.sports_fee, str.other_fees,
          disc, schol, totalFee, finalPayable, academic_year_id || str.academic_year_id
        ]);

        const studentFeeId = sfRes.insertId;
        const inst1 = Math.round(finalPayable / 2);
        const inst2 = finalPayable - inst1;
        await connection.query(`
          INSERT INTO installments (student_fee_id, installment_number, amount, due_date, paid_amount, status) VALUES
          (?, 1, ?, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 0.00, 'pending'),
          (?, 2, ?, DATE_ADD(CURDATE(), INTERVAL 90 DAY), 0.00, 'pending')
        `, [studentFeeId, inst1, studentFeeId, inst2]);
      }
    }

    await connection.commit();
    return res.status(201).json({ success: true, message: 'Student added successfully', data: { studentId } });
  } catch (err) {
    await connection.rollback();
    console.error('createStudent error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create student record' });
  } finally {
    connection.release();
  }
};

exports.getStudentById = async (req, res) => {
  try {
    const studentId = req.params.id;
    const [students] = await pool.query(`
      SELECT 
        s.*, 
        c.name as course_name, c.code as course_code,
        d.name as department_name, d.code as department_code,
        ay.name as academic_year_name,
        u.email as account_email
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
      WHERE s.id = ?
    `, [studentId]);

    if (students.length === 0) return res.status(404).json({ success: false, error: 'Student not found' });
    const student = students[0];

    const [feeRows] = await pool.query(`
      SELECT sf.*, fs.name as fee_structure_name
      FROM student_fees sf
      LEFT JOIN fee_structures fs ON sf.fee_structure_id = fs.id
      WHERE sf.student_id = ?
      ORDER BY sf.id DESC LIMIT 1
    `, [studentId]);

    let feeDetails = null;
    let installments = [];
    if (feeRows.length > 0) {
      feeDetails = feeRows[0];
      const [instRows] = await pool.query('SELECT * FROM installments WHERE student_fee_id = ? ORDER BY installment_number ASC', [feeDetails.id]);
      installments = instRows;
    }

    const [payments] = await pool.query(`
      SELECT p.*, r.id as receipt_id, r.receipt_number
      FROM payments p
      LEFT JOIN receipts r ON r.payment_id = p.id
      WHERE p.student_id = ?
      ORDER BY p.id DESC
    `, [studentId]);

    const [receipts] = await pool.query(`
      SELECT r.*, p.payment_method, p.transaction_id
      FROM receipts r
      JOIN payments p ON r.payment_id = p.id
      WHERE r.student_id = ?
      ORDER BY r.id DESC
    `, [studentId]);

    return res.json({ success: true, data: { student, fee: feeDetails, installments, payments, receipts } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve student details' });
  }
};

exports.updateStudent = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const studentId = req.params.id;
    const { name, email, phone, roll_number, course_id, department_id, academic_year_id, status } = req.body;

    const [existing] = await connection.query('SELECT user_id FROM students WHERE id = ?', [studentId]);
    if (existing.length === 0) return res.status(404).json({ success: false, error: 'Student not found' });

    if (name && /\d/.test(name)) return res.status(400).json({ success: false, error: 'Name must not contain numbers' });
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return res.status(400).json({ success: false, error: 'Invalid email address' });
      await connection.query('UPDATE users SET email = ? WHERE id = ?', [email.trim(), existing[0].user_id]);
    }

    await connection.query(`
      UPDATE students SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        roll_number = COALESCE(?, roll_number),
        course_id = COALESCE(?, course_id),
        department_id = COALESCE(?, department_id),
        academic_year_id = COALESCE(?, academic_year_id),
        status = COALESCE(?, status)
      WHERE id = ?
    `, [
      name ? name.trim() : null,
      email ? email.trim() : null,
      phone ? phone.trim() : null,
      roll_number ? roll_number.trim() : null,
      course_id || null, department_id || null, academic_year_id || null, status || null,
      studentId
    ]);

    await connection.commit();
    return res.json({ success: true, message: 'Student updated successfully' });
  } catch (err) {
    await connection.rollback();
    return res.status(500).json({ success: false, error: 'Failed to update student' });
  } finally {
    connection.release();
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const studentId = req.params.id;
    const [rows] = await pool.query('SELECT user_id FROM students WHERE id = ?', [studentId]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Student not found' });
    await pool.query('DELETE FROM users WHERE id = ?', [rows[0].user_id]);
    return res.json({ success: true, message: 'Student deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to delete student' });
  }
};
