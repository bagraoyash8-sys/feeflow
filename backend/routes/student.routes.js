const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student.controller');
const { verifyToken, requireStudent } = require('../middleware/auth');

router.use(verifyToken, requireStudent);

router.get('/dashboard', studentController.getDashboard);
router.get('/fees', studentController.getFees);
router.get('/payments', studentController.getPayments);
router.post('/payments', studentController.processDemoPayment);
router.get('/receipts', studentController.getReceipts);
router.get('/receipts/:id', studentController.getReceiptById);
router.get('/profile', studentController.getProfile);

module.exports = router;
