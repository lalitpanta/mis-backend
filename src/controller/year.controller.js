const yearSVC = require("../validation/year.validation");
const yearService = require("../services/year.service");

class YearController {
  /**
   * Create or update year
   */
  upload_year = async (req, res, next) => {
    try {
      const yearData = await yearSVC.year(req.body);

      const result = await yearService.uploadYear(yearData, req);

      return res.status(201).json({
        message: "Year data uploaded successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get all years or specific year by ID
   */
  get_year = async (req, res, next) => {
    try {
      const yearId = req.params.id;

      if (yearId) {
        // Get specific year by ID
        const result = await yearService.getYearById(yearId, req);

        if (!result) {
          return res.status(404).json({ error: "Year not found" });
        }

        return res.status(200).json({
          message: "Year data retrieved successfully",
          data: result,
        });
      } else {
        // Get all years
        const results = await yearService.getAllYears(req);

        return res.status(200).json({
          message: "Year data retrieved successfully",
          data: results,
        });
      }
    } catch (err) {
      next(err);
    }
  };

  /**
   * Delete year by ID
   */
  delete_year = async (req, res, next) => {
    try {
      const yearId = req.params.id;

      const result = await yearService.deleteYear(yearId, req);

      if (!result) {
        return res.status(404).json({ error: "Year not found" });
      }

      return res.status(200).json({
        message: `Year with id ${yearId} deleted successfully`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}

const yearCTRL = new YearController();
module.exports = yearCTRL;
