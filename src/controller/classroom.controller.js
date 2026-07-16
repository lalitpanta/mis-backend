const classroomService = require("../services/classroom.service");

class ClassroomController {
  list = async (req, res, next) => {
    try {
      const rows = await classroomService.list(req);
      return res
        .status(200)
        .json({ message: "Classrooms retrieved", data: rows });
    } catch (err) {
      console.error("Error loading classrooms:", err);
      return res
        .status(500)
        .json({
          message: `Failed to load classrooms: ${err.message}`,
          data: null,
        });
    }
  };

  create = async (req, res, next) => {
    try {
      const created = await classroomService.create(req.body || {}, req);
      return res
        .status(201)
        .json({ message: "Classroom created", data: created });
    } catch (err) {
      console.error("Error creating classroom:", err);
      return res
        .status(500)
        .json({
          message: `Failed to create classroom: ${err.message}`,
          data: null,
        });
    }
  };

  update = async (req, res, next) => {
    try {
      const id = req.params.id;
      const updated = await classroomService.update(id, req.body || {}, req);
      return res
        .status(200)
        .json({ message: "Classroom updated", data: updated });
    } catch (err) {
      console.error("Error updating classroom:", err);
      return res
        .status(500)
        .json({
          message: `Failed to update classroom: ${err.message}`,
          data: null,
        });
    }
  };

  remove = async (req, res, next) => {
    try {
      const id = req.params.id;
      const deleted = await classroomService.remove(id, req);
      return res
        .status(200)
        .json({ message: "Classroom deleted", data: deleted });
    } catch (err) {
      console.error("Error deleting classroom:", err);
      return res
        .status(500)
        .json({
          message: `Failed to delete classroom: ${err.message}`,
          data: null,
        });
    }
  };

  createSections = async (req, res, next) => {
    try {
      const classroomId = req.params.id;
      const sections = req.body?.sections || [];
      if (!Array.isArray(sections) || sections.length === 0) {
        return res
          .status(400)
          .json({ message: "Sections must be a non-empty array", data: null });
      }
      const created = await classroomService.createSections(
        classroomId,
        sections,
        req,
      );
      return res
        .status(201)
        .json({ message: "Sections created", data: created });
    } catch (err) {
      console.error("Error creating classroom sections:", err);
      return res
        .status(500)
        .json({
          message: `Failed to create sections: ${err.message}`,
          data: null,
        });
    }
  };

  listSections = async (req, res, next) => {
    try {
      const classroomId = req.params.id;
      const rows = await classroomService.listSections(classroomId, req);
      return res
        .status(200)
        .json({ message: "Classroom sections", data: rows });
    } catch (err) {
      console.error("Error loading classroom sections:", err);
      return res
        .status(500)
        .json({
          message: `Failed to load sections: ${err.message}`,
          data: null,
        });
    }
  };

  updateSection = async (req, res, next) => {
    try {
      const sectionId = req.params.sectionId;
      const { name, class_teacher_id } = req.body;
      if (!name) {
        return res
          .status(400)
          .json({ message: "Section name is required", data: null });
      }
      const updated = await classroomService.updateSection(
        sectionId,
        { name, class_teacher_id },
        req,
      );
      return res
        .status(200)
        .json({ message: "Section updated", data: updated });
    } catch (err) {
      console.error("Error updating classroom section:", err);
      return res
        .status(500)
        .json({
          message: `Failed to update section: ${err.message}`,
          data: null,
        });
    }
  };

  deleteSection = async (req, res, next) => {
    try {
      const sectionId = req.params.sectionId;
      const deleted = await classroomService.deleteSection(sectionId, req);
      return res
        .status(200)
        .json({ message: "Section deleted", data: deleted });
    } catch (err) {
      console.error("Error deleting classroom section:", err);
      return res
        .status(500)
        .json({
          message: `Failed to delete section: ${err.message}`,
          data: null,
        });
    }
  };
}

module.exports = new ClassroomController();
