const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authorization token missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'feeflow_super_secret_jwt_key_2026_xyz');

    req.user = decoded;

    // Fetch extra details if student or admin
    if (decoded.role === 'student') {
      const [students] = await pool.query('SELECT * FROM students WHERE user_id = ?', [decoded.id]);
      if (students.length === 0) {
        return res.status(401).json({ success: false, error: 'Student record not found' });
      }
      req.student = students[0];
    } else if (decoded.role === 'admin') {
      const [admins] = await pool.query('SELECT * FROM admins WHERE user_id = ?', [decoded.id]);
      if (admins.length > 0) {
        req.admin = admins[0];
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Access denied: Administrator role required' });
  }
  next();
};

const requireStudent = (req, res, next) => {
  if (!req.user || req.user.role !== 'student') {
    return res.status(403).json({ success: false, error: 'Access denied: Student role required' });
  }
  next();
};

module.exports = {
  verifyToken,
  requireAdmin,
  requireStudent
};
