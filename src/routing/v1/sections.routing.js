const express = require('express');
const router = express.Router();
const sectionsController = require('../../controller/sections.controller');

router.get('/', sectionsController.getAll);
router.get('/:id', sectionsController.getById);
router.get('/by-room/:roomId', sectionsController.getByRoomId);
router.post('/', sectionsController.create);
router.put('/:id', sectionsController.update);
router.delete('/:id', sectionsController.delete);

module.exports = router;
