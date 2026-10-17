const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// All admin routes require valid admin authentication
router.use(verifyToken, requireAdmin);

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// Students
router.get('/students', adminController.getStudents);
router.post('/students', adminController.createStudent);
router.get('/students/:id', adminController.getStudentById);
router.put('/students/:id', adminController.updateStudent);
router.delete('/students/:id', adminController.deleteStudent);

// Fee Structures
router.get('/fee-structures', adminController.getFeeStructures);
router.post('/fee-structures', adminController.createFeeStructure);
router.put('/fee-structures/:id', adminController.updateFeeStructure);

// Assign Fees
router.post('/student-fees/assign', adminController.assignStudentFee);

// Payments & Collection
router.get('/payments', adminController.getPayments);
router.post('/payments', adminController.recordPayment);

// Installments
router.get('/installments', adminController.getInstallments);

// Receipts
router.get('/receipts', adminController.getReceipts);
router.get('/receipts/:id', adminController.getReceiptById);

// Discounts & Scholarships
router.get('/discounts-scholarships', adminController.getDiscountsScholarships);
router.post('/discounts', adminController.createDiscount);
router.delete('/discounts/:id', adminController.deleteDiscount);
router.post('/scholarships', adminController.createScholarship);
router.delete('/scholarships/:id', adminController.deleteScholarship);

// Reports
router.get('/reports/daily', adminController.getDailyReport);
router.get('/reports/monthly', adminController.getMonthlyReport);
router.get('/reports/yearly', adminController.getYearlyReport);
router.get('/reports/student-wise', adminController.getStudentWiseReport);
router.get('/reports/pending', adminController.getPendingFeeReport);
router.get('/reports/overdue', adminController.getOverdueReport);
router.get('/reports/department-wise', adminController.getDepartmentWiseReport);
router.get('/reports/payment-method', adminController.getPaymentMethodReport);

// Courses, Departments, Academic Years
router.get('/courses', adminController.getCourses);
router.post('/courses', adminController.createCourse);
router.delete('/courses/:id', adminController.deleteCourse);

router.get('/departments', adminController.getDepartments);
router.post('/departments', adminController.createDepartment);
router.delete('/departments/:id', adminController.deleteDepartment);

router.get('/academic-years', adminController.getAcademicYears);
router.post('/academic-years', adminController.createAcademicYear);
router.put('/academic-years/:id/set-current', adminController.setAcademicYearCurrent);

// Admin Profile
router.get('/profile', adminController.getAdminProfile);
router.put('/profile', adminController.updateAdminProfile);

module.exports = router;
