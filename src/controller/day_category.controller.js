const dayCategoryService = require("../services/day_category.service");

class DayCategoryController {
  /**
   * Get all day categories
   */
  getAllCategories = async (req, res, next) => {
    try {
      const { year_id } = req.query;
      const results = await dayCategoryService.getAllCategories(year_id, req);
      return res.status(200).json({
        message: "Day categories retrieved successfully",
        data: results,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Create or update a day category
   */
  createCategory = async (req, res, next) => {
    try {
      const { category_name } = req.body;
      if (!category_name) {
        return res.status(400).json({ error: "Category name is required" });
      }
      const result = await dayCategoryService.createCategory(category_name, req);
      return res.status(201).json({
        message: "Day category saved successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Update a day category
   */
  updateCategory = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { category_name } = req.body;
      if (!category_name) {
        return res.status(400).json({ error: "Category name is required" });
      }
      const result = await dayCategoryService.updateCategory(id, category_name, req);
      return res.status(200).json({
        message: "Day category updated successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Delete a day category
   */
  deleteCategory = async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await dayCategoryService.deleteCategory(id, req);
      if (!result) {
        return res.status(404).json({ error: "Category not found" });
      }
      return res.status(200).json({
        message: "Day category deleted successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new DayCategoryController();
