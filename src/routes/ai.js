const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Route 1: POST /api/ai/insight -> Dapatkan insight ringkas
router.post('/insight', aiController.getInsight);

// Route 2: POST /api/ai/action-plan -> Dapatkan rencana tindakan detail
router.post('/action-plan', aiController.getActionPlan);

module.exports = router;
