const Joi = require("joi");

class CalendarValidation {
  validate_calendar_query = async (data) => {
    try {
      const schema = Joi.object({
        year_label: Joi.string().required().messages({
          "string.empty": "year_label cannot be empty",
          "any.required": "year_label is required",
        }),
        month_name: Joi.string().required().messages({
          "string.empty": "month_name cannot be empty",
          "any.required": "month_name is required",
        }),
        date_format: Joi.string()
          .valid("BS", "AD")
          .optional()
          .default("BS")
          .messages({
            "any.only": "date_format must be 'BS' or 'AD'",
          }),
      });
      const validatedData = await schema.validateAsync(data);
      return validatedData;
    } catch (err) {
      return { error: err.message };
    }
  };
}

const calendarValidationSVC = new CalendarValidation();
module.exports = calendarValidationSVC;
