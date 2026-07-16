const express = require('express');
const router = express.Router();
const dailyReportsController = require('../../controller/dailyReports.controller');

// Templates
router.get('/templates', dailyReportsController.getTemplates);
router.post('/templates', dailyReportsController.createTemplate);
router.patch('/templates/:id', dailyReportsController.updateTemplate);
router.delete('/templates/:id', dailyReportsController.deleteTemplate);

// Reports
router.post('/', dailyReportsController.createReport);
router.post('/bulk-send', dailyReportsController.bulkSendReports);
router.get('/', dailyReportsController.listReports);
router.delete('/:id', dailyReportsController.deleteReport);

module.exports = router;
