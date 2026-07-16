const coursesService = require("../services/courses.service");

class CoursesController {
  list = async (req, res, next) => {
    try {
      const rows = await coursesService.list(req);
      return res.status(200).json({ message: "Courses retrieved", data: rows });
    } catch (err) {
      next(err);
    }
  };

  get = async (req, res, next) => {
    try {
      const course = await coursesService.get(req.params.id, req);
      if (!course) return res.status(404).json({ message: "Course not found" });
      return res
        .status(200)
        .json({ message: "Course retrieved", data: course });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const payload = req.body || {};
      const created = await coursesService.create(payload, req);
      return res.status(201).json({ message: "Course created", data: created });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const payload = req.body || {};
      const updated = await coursesService.update(req.params.id, payload, req);
      return res.status(200).json({ message: "Course updated", data: updated });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      const deleted = await coursesService.remove(req.params.id, req);
      if (!deleted)
        return res.status(404).json({ message: "Course not found" });
      return res.status(200).json({ message: "Course deleted", data: deleted });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new CoursesController();
