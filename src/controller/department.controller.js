const departmentService = require('../services/department.service');

class DepartmentController {
  list = async (req, res, next) => {
    try {
      const deps = await departmentService.listDepartments(req);
      return res.status(200).json({ message: 'Departments retrieved', data: deps });
    } catch (err) {
      next(err);
    }
  };

  get = async (req, res, next) => {
    try {
      const id = req.params.id;
      const dep = await departmentService.getDepartment(id, req);
      if (!dep) return res.status(404).json({ message: 'Department not found' });
      return res.status(200).json({ message: 'Department retrieved', data: dep });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const payload = req.body || {};
      const dep = await departmentService.createDepartment(payload, req);
      return res.status(201).json({ message: 'Department created', data: dep });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const id = req.params.id;
      const payload = req.body || {};
      const dep = await departmentService.updateDepartment(id, payload, req);
      return res.status(200).json({ message: 'Department updated', data: dep });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      const id = req.params.id;
      const deleted = await departmentService.deleteDepartment(id, req);
      if (!deleted) return res.status(404).json({ message: 'Department not found' });
      return res.status(200).json({ message: 'Department deleted', data: deleted });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new DepartmentController();
