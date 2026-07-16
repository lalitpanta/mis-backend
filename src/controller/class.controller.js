const classService = require('../services/class.service');

class ClassController {
  listClasses = async (req, res, next) => {
    try { const rows = await classService.listClasses(req); return res.status(200).json({ message: 'Classes retrieved', data: rows }); } catch (err) { next(err); }
  };

  createClass = async (req, res, next) => {
    try { const created = await classService.createClass(req.body || {}, req); return res.status(201).json({ message: 'Class created', data: created }); } catch (err) { next(err); }
  };

  listSections = async (req, res, next) => {
    try { const rows = await classService.listSections(req); return res.status(200).json({ message: 'Sections retrieved', data: rows }); } catch (err) { next(err); }
  };

  createSection = async (req, res, next) => {
    try { const created = await classService.createSection(req.body || {}, req); return res.status(201).json({ message: 'Section created', data: created }); } catch (err) { next(err); }
  };
}

module.exports = new ClassController();
