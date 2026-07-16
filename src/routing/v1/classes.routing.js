const express = require('express');
const router = express.Router();
const classesController = require('../../controller/classes.controller');

router.get('/', classesController.getAll);
router.get('/:id', classesController.getById);
router.post('/', classesController.create);
router.put('/:id', classesController.update);
router.delete('/:id', classesController.delete);

module.exports = router;
