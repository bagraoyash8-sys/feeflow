module.exports = {
  ...require('./admin.dashboard.controller'),
  ...require('./admin.student.controller'),
  ...require('./admin.fee.controller'),
  ...require('./admin.report.controller'),
  ...require('./admin.master.controller')
};
