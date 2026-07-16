const express = require('express');
const router = express.Router();
const roomsController = require('../../controller/rooms.controller');

router.get('/', roomsController.getAll);
router.get('/:id', roomsController.getById);
router.post('/', roomsController.create);
router.put('/:id', roomsController.update);
router.delete('/:id', roomsController.delete);

module.exports = router;
