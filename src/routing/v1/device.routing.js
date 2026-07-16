const express = require('express');
const DeviceController = require('../../controller/device.controller');

const router = express.Router();

// Device CRUD
router.post('/', DeviceController.createDevice);
router.get('/', DeviceController.listDevices);
router.get('/:deviceId', DeviceController.getDevice);
router.patch('/:deviceId', DeviceController.updateDevice);
router.delete('/:deviceId', DeviceController.deleteDevice);

// Device connection testing
router.post('/:deviceId/test-connection', DeviceController.testConnection);

// Sync operations
router.post('/:deviceId/sync-now', DeviceController.syncNow);
router.get('/:deviceId/sync-logs', DeviceController.getSyncLogs);

// Teacher enrollment
router.post('/:deviceId/enroll-teachers', DeviceController.enrollTeachers);
router.get('/:deviceId/enrollments', DeviceController.getEnrollments);

// Unmatched IDs
router.get('/:deviceId/unmatched-ids', DeviceController.getUnmatchedIds);

// Attendance records
router.get('/:deviceId/attendance-records', DeviceController.getAttendanceRecords);
router.get('/:deviceId/attendance-summary', DeviceController.getAttendanceSummary);
router.patch('/attendance/:recordId/override', DeviceController.overrideAttendance);

module.exports = router;
