const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth');

router.post('/login', authController.login);
router.get('/me', verifyToken, authController.getMe);
router.post('/change-password', verifyToken, authController.changePassword);

module.exports = router;
