const pool = require('../config/db');

exports.getInstituteSettings = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM institute_settings WHERE id = 1');
    if (rows.length === 0) {
      return res.json({
        success: true,
        data: {
          institute_name: 'FeeFlow Institute of Technology',
          code: 'FIT-2026',
          address: '402 Knowledge Boulevard, Tech Campus, Mumbai - 400076',
          phone: '+91 98765 43210',
          email: 'accounts@feeflow.edu',
          website: 'www.feeflow.edu',
          receipt_prefix: 'REC-',
          currency_symbol: '₹'
        }
      });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to load institute settings' });
  }
};

exports.updateInstituteSettings = async (req, res) => {
  try {
    const { institute_name, code, address, phone, email, website, receipt_prefix, currency_symbol } = req.body;

    await pool.query(`
      UPDATE institute_settings SET
        institute_name = COALESCE(?, institute_name),
        code = COALESCE(?, code),
        address = COALESCE(?, address),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        website = COALESCE(?, website),
        receipt_prefix = COALESCE(?, receipt_prefix),
        currency_symbol = COALESCE(?, currency_symbol)
      WHERE id = 1
    `, [institute_name, code, address, phone, email, website, receipt_prefix, currency_symbol]);

    return res.json({ success: true, message: 'Institute settings updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update institute settings' });
  }
};
