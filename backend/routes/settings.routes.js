const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.get('/institute', settingsController.getInstituteSettings);
router.put('/institute', verifyToken, requireAdmin, settingsController.updateInstituteSettings);

module.exports = router;
