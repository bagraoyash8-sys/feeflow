const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

exports.login = async (req, res) => {
  try {
    const { identifier, password, role } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: 'Identifier (Email or Roll Number) and password are required' });
    }

    let user = null;
    let student = null;
    let admin = null;

    if (role === 'student') {
      // Check if identifier is email or roll_number
      const [studentRows] = await pool.query(
        `SELECT s.*, u.password_hash, u.id as user_id, u.role, u.email as user_email
         FROM students s
         JOIN users u ON s.user_id = u.id
         WHERE s.roll_number = ? OR u.email = ?`,
        [identifier.trim(), identifier.trim()]
      );

      if (studentRows.length === 0) {
        return res.status(401).json({ success: false, error: 'Incorrect login credentials or student not found' });
      }

      const row = studentRows[0];
      const isMatch = await bcrypt.compare(password, row.password_hash);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Incorrect login credentials' });
      }

      if (row.status === 'inactive') {
        return res.status(403).json({ success: false, error: 'Your student account is deactivated. Please contact college administration.' });
      }

      user = { id: row.user_id, email: row.user_email, role: 'student' };
      student = {
        id: row.id,
        name: row.name,
        roll_number: row.roll_number,
        email: row.email,
        phone: row.phone,
        course_id: row.course_id,
        department_id: row.department_id,
        academic_year_id: row.academic_year_id
      };
    } else {
      // Admin login (email + password)
      const [userRows] = await pool.query('SELECT * FROM users WHERE email = ? AND role = "admin"', [identifier.trim()]);
      if (userRows.length === 0) {
        return res.status(401).json({ success: false, error: 'Incorrect admin login credentials' });
      }

      const row = userRows[0];
      const isMatch = await bcrypt.compare(password, row.password_hash);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Incorrect admin login credentials' });
      }

      user = { id: row.id, email: row.email, role: 'admin' };
      const [adminRows] = await pool.query('SELECT * FROM admins WHERE user_id = ?', [row.id]);
      if (adminRows.length > 0) {
        admin = adminRows[0];
      }
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'feeflow_super_secret_jwt_key_2026_xyz',
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: admin ? admin.name : (student ? student.name : 'User'),
          profile: admin || student
        }
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, error: 'An unexpected server error occurred during login' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    if (role === 'admin') {
      const [admins] = await pool.query(`
        SELECT a.*, u.email, u.role
        FROM admins a
        JOIN users u ON a.user_id = u.id
        WHERE u.id = ?
      `, [userId]);
      if (admins.length === 0) return res.status(404).json({ success: false, error: 'Admin not found' });
      return res.json({ success: true, data: admins[0] });
    } else {
      const [students] = await pool.query(`
        SELECT s.*, c.name as course_name, c.code as course_code,
               d.name as department_name, d.code as department_code,
               ay.name as academic_year_name, u.email as user_email, u.role
        FROM students s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN courses c ON s.course_id = c.id
        LEFT JOIN departments d ON s.department_id = d.id
        LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
        WHERE u.id = ?
      `, [userId]);
      if (students.length === 0) return res.status(404).json({ success: false, error: 'Student not found' });
      return res.json({ success: true, data: students[0] });
    }
  } catch (err) {
    console.error('getMe error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch user profile' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Both current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters long' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update password' });
  }
};
