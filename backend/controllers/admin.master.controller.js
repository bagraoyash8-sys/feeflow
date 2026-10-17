const bcrypt = require('bcryptjs');
const pool = require('../config/db');

exports.getCourses = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM courses ORDER BY name ASC');
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to load courses' });
  }
};

exports.createCourse = async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) return res.status(400).json({ success: false, error: 'Name and Code are required' });
    const [result] = await pool.query('INSERT INTO courses (name, code) VALUES (?, ?)', [name.trim(), code.trim()]);
    return res.status(201).json({ success: true, message: 'Course added', data: { id: result.insertId } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to create course' });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    await pool.query('DELETE FROM courses WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Course removed' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to delete course' });
  }
};

exports.getDepartments = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM departments ORDER BY name ASC');
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to load departments' });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) return res.status(400).json({ success: false, error: 'Name and Code are required' });
    const [result] = await pool.query('INSERT INTO departments (name, code) VALUES (?, ?)', [name.trim(), code.trim()]);
    return res.status(201).json({ success: true, message: 'Department added', data: { id: result.insertId } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to create department' });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    await pool.query('DELETE FROM departments WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Department removed' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to delete department' });
  }
};

exports.getAcademicYears = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM academic_years ORDER BY id DESC');
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to load academic years' });
  }
};

exports.createAcademicYear = async (req, res) => {
  try {
    const { name, start_date, end_date, is_current } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
    if (is_current) {
      await pool.query('UPDATE academic_years SET is_current = 0');
    }
    const [result] = await pool.query(
      'INSERT INTO academic_years (name, start_date, end_date, is_current) VALUES (?, ?, ?, ?)',
      [name.trim(), start_date || null, end_date || null, is_current ? 1 : 0]
    );
    return res.status(201).json({ success: true, message: 'Academic year created', data: { id: result.insertId } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to create academic year' });
  }
};

exports.setAcademicYearCurrent = async (req, res) => {
  try {
    const id = req.params.id;
    await pool.query('UPDATE academic_years SET is_current = 0');
    await pool.query('UPDATE academic_years SET is_current = 1 WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Current academic year updated' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update academic year' });
  }
};

exports.getAdminProfile = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.*, u.email
      FROM admins a
      JOIN users u ON a.user_id = u.id
      WHERE u.id = ?
    `, [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Admin profile not found' });
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to load profile' });
  }
};

exports.updateAdminProfile = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { name, email, phone, password } = req.body;

    if (email) {
      await connection.query('UPDATE users SET email = ? WHERE id = ?', [email.trim(), req.user.id]);
    }

    if (password && password.trim().length >= 6) {
      const hash = await bcrypt.hash(password.trim(), 10);
      await connection.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    }

    await connection.query(`
      UPDATE admins SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone)
      WHERE user_id = ?
    `, [name ? name.trim() : null, phone ? phone.trim() : null, req.user.id]);

    await connection.commit();
    return res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err) {
    await connection.rollback();
    return res.status(500).json({ success: false, error: 'Failed to update profile' });
  } finally {
    connection.release();
  }
};
