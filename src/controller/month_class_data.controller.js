const month_classificationSVC = require("../validation/month_class_data.validation");
const monthClassDataService = require("../services/month_class_data.service");

class monthController {
  /**
   * Create month class data
   */
  upload_month = async (req, res, next) => {
    try {
      const monthData = await month_classificationSVC.Put_month_data(req.body);

      if (monthData.error) {
        return res.status(400).json({ error: monthData.error });
      }

      // 1. Create month
      const result = await monthClassDataService.uploadMonth(monthData, req);

      // 2. Auto-generate calendar days for this month
      const calendarDays =
        await monthClassDataService.generateCalendarDaysForMonth(
          result.id,
          result,
          req,
        );

      return res.status(201).json({
        message: `Month created successfully with ${calendarDays.length} calendar days auto-generated`,
        data: {
          month: result,
          calendar_days_count: calendarDays.length,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get all month class data
   */
  get_month = async (req, res, next) => {
    try {
      const results = await monthClassDataService.getAllMonths(req);

      return res.status(200).json({
        message: "Month data retrieved successfully",
        data: results,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Update month class data
   */
  update_month = async (req, res, next) => {
    try {
      const monthId = req.params.id;
      const updateData = await month_classificationSVC.update_month_data(
        req.body,
      );

      if (updateData.error) {
        return res.status(400).json({ error: updateData.error });
      }

      // 1. Update month data
      const result = await monthClassDataService.updateMonth(
        monthId,
        updateData,
        req,
      );

      if (!result) {
        return res.status(404).json({ error: "Month not found" });
      }

      // 2. Check if dates or days were updated
      const datesChanged =
        updateData.month_start_date_BS ||
        updateData.month_end_date_BS ||
        updateData.month_start_day_BS ||
        updateData.month_end_day_BS ||
        updateData.month_start_date_AD ||
        updateData.month_end_date_AD ||
        updateData.month_start_day_AD ||
        updateData.month_end_day_AD;

      // 3. If dates/days changed, regenerate calendar_days
      if (datesChanged) {
        const regeneratedCalendarDays =
          await monthClassDataService.regenerateCalendarDaysForMonth(
            monthId,
            result,
            req,
          );

        return res.status(200).json({
          message: `Month updated successfully and calendar days regenerated (${regeneratedCalendarDays.length} days)`,
          data: {
            month: result,
            calendar_days_count: regeneratedCalendarDays.length,
          },
        });
      }

      return res.status(200).json({
        message: "Month updated successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Delete month class data
   */
  delete_month = async (req, res, next) => {
    try {
      const monthId = req.params.id;

      // Delete associated calendar days first (cascade would handle it, but explicit is safer)
      // Note: Migration has ON DELETE CASCADE, so this is redundant but safe
      const result = await monthClassDataService.deleteMonth(monthId, req);

      if (!result) {
        return res.status(404).json({ error: "Month not found" });
      }

      return res.status(200).json({
        message: `Month with id ${monthId} deleted successfully (including all associated calendar days)`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}
const monthCTRL = new monthController();
module.exports = monthCTRL;
