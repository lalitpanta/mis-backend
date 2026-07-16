const day_classificationSVC = require("../validation/day_classification.validation");
const dayClassificationService = require("../services/day_classification.service");

class dayController {
  /**
   * Create day classification
   */
  upload_day = async (req, res, next) => {
    try {
      const dayData = await day_classificationSVC.Put_day_data(req.body);

      if (dayData.error) {
        return res.status(400).json({ error: dayData.error });
      }

      const result = await dayClassificationService.uploadDay(dayData, req);

      return res.status(201).json({
        message: "Day data uploaded successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get all day classifications
   */
  get_day = async (req, res, next) => {
    try {
      const results = await dayClassificationService.getAllDays(req);

      return res.status(200).json({
        message: "Day data retrieved successfully",
        data: results,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Update day classification
   */
  update_day = async (req, res, next) => {
    try {
      const dayId = req.params.id;
      const updateData = await day_classificationSVC.update_day_data(req.body);

      if (updateData.error) {
        return res.status(400).json({ error: updateData.error });
      }

      const result = await dayClassificationService.updateDay(
        dayId,
        updateData,
        req,
      );

      if (!result) {
        return res.status(404).json({ error: "Day not found" });
      }

      return res.status(200).json({
        message: `Day with id ${dayId} updated successfully`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Delete day classification
   */
  delete_day = async (req, res, next) => {
    try {
      const dayId = req.params.id;

      const result = await dayClassificationService.deleteDay(dayId, req);

      if (!result) {
        return res.status(404).json({ error: "Day not found" });
      }

      return res.status(200).json({
        message: `Day with id ${dayId} deleted successfully`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}
const dayCTRL = new dayController();
module.exports = dayCTRL;
