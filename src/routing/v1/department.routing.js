const express = require('express');
const router = express.Router();
const deptCTRL = require('../../controller/department.controller');

// GET /v1/departments
router.get('/', deptCTRL.list);

// GET /v1/departments/:id
router.get('/:id', deptCTRL.get);

// POST /v1/departments
router.post('/', deptCTRL.create);

// PUT /v1/departments/:id
router.put('/:id', deptCTRL.update);

// DELETE /v1/departments/:id
router.delete('/:id', deptCTRL.remove);

module.exports = router;
