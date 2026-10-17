const pool = require('../config/db');

exports.getDashboard = async (req, res) => {
  try {
    const [totalStudentsRows] = await pool.query('SELECT COUNT(*) as count FROM students WHERE status = "active"');
    const totalStudents = totalStudentsRows[0].count;

    const [feeStats] = await pool.query(`
      SELECT 
        COALESCE(SUM(final_payable), 0) as totalFees,
        COALESCE(SUM(paid_amount), 0) as totalCollected,
        COALESCE(SUM(final_payable - paid_amount), 0) as totalPending
      FROM student_fees sf
      JOIN students s ON sf.student_id = s.id
      WHERE s.status = "active"
    `);

    const todayStr = new Date().toISOString().split('T')[0];
    const [todayStats] = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as todayCollection
      FROM payments
      WHERE DATE(payment_date) = ?
    `, [todayStr]);

    const [overdueStats] = await pool.query(`
      SELECT COALESCE(SUM(amount - paid_amount), 0) as overdueAmount
      FROM installments
      WHERE status = 'overdue' OR (due_date < CURDATE() AND paid_amount < amount)
    `);

    const [monthlyRows] = await pool.query(`
      SELECT 
        DATE_FORMAT(payment_date, '%b %Y') as month,
        DATE_FORMAT(payment_date, '%Y-%m') as sortKey,
        COALESCE(SUM(amount), 0) as amount
      FROM payments
      WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY sortKey, month
      ORDER BY sortKey ASC
    `);

    const [deptRows] = await pool.query(`
      SELECT 
        COALESCE(d.name, 'Unassigned') as department,
        COALESCE(SUM(p.amount), 0) as amount
      FROM payments p
      JOIN students s ON p.student_id = s.id
      LEFT JOIN departments d ON s.department_id = d.id
      GROUP BY d.name
    `);

    const [statusDistRows] = await pool.query(`
      SELECT 
        CASE 
          WHEN sf.paid_amount >= sf.final_payable THEN 'Fully Paid'
          WHEN sf.paid_amount > 0 AND sf.paid_amount < sf.final_payable THEN 'Partially Paid'
          WHEN EXISTS (SELECT 1 FROM installments i WHERE i.student_fee_id = sf.id AND (i.status = 'overdue' OR (i.due_date < CURDATE() AND i.paid_amount < i.amount))) THEN 'Overdue'
          ELSE 'Unpaid'
        END as status,
        COUNT(*) as count
      FROM student_fees sf
      JOIN students s ON sf.student_id = s.id
      WHERE s.status = 'active'
      GROUP BY status
    `);

    const [recentTransactions] = await pool.query(`
      SELECT 
        p.id, p.amount, p.payment_method, p.transaction_id, p.payment_date, p.remarks,
        s.id as student_id, s.name as student_name, s.roll_number,
        r.id as receipt_id, r.receipt_number
      FROM payments p
      JOIN students s ON p.student_id = s.id
      LEFT JOIN receipts r ON r.payment_id = p.id
      ORDER BY p.id DESC
      LIMIT 10
    `);

    return res.json({
      success: true,
      data: {
        cards: {
          totalStudents,
          totalFees: Number(feeStats[0].totalFees),
          totalCollected: Number(feeStats[0].totalCollected),
          totalPending: Number(feeStats[0].totalPending),
          overdueFees: Number(overdueStats[0].overdueAmount),
          todayCollection: Number(todayStats[0].todayCollection)
        },
        charts: {
          monthlyCollection: monthlyRows,
          departmentCollection: deptRows,
          paidVsPending: {
            paid: Number(feeStats[0].totalCollected),
            pending: Number(feeStats[0].totalPending)
          },
          statusDistribution: statusDistRows
        },
        recentTransactions
      }
    });
  } catch (err) {
    console.error('getDashboard error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load dashboard metrics' });
  }
};
