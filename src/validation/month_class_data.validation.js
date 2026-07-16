const Joi = require("joi");

class month_classification {
  Put_month_data = async (data) => {
    try {
      const schema = Joi.object({
        year_id: Joi.string().uuid().optional(),
        year_label: Joi.string().optional(),
        month_name: Joi.string().required(),
        bs_month_index: Joi.number().integer().min(1).max(12).optional(),
        month_start_date_BS: Joi.string().optional().allow(''),
        month_end_date_BS: Joi.string().optional().allow(''),
        month_start_date_AD: Joi.string().optional().allow(''),
        month_end_date_AD: Joi.string().optional().allow(''),
        month_start_day_BS: Joi.string().optional().allow(''),
        month_end_day_BS: Joi.string().optional().allow(''),
        month_start_day_AD: Joi.string().optional().allow(''),
        month_end_day_AD: Joi.string().optional().allow(''),
        date_format: Joi.string().optional(),
      }).or('year_id', 'year_label'); // Require either year_id or year_label
      const validatedData = await schema.validateAsync(data);
      console.log(validatedData);
      return validatedData;
    } catch (err) {
      console.log(err);
      return { error: err.message };
    }
  };

  update_month_data = async (data) => {
    try {
      const schema = Joi.object({
        year_id: Joi.string().uuid().optional(),
        year_label: Joi.string().optional(),
        month_name: Joi.string().optional(),
        bs_month_index: Joi.number().integer().min(1).max(12).optional(),
        month_start_date_BS: Joi.string().optional().allow(''),
        month_end_date_BS: Joi.string().optional().allow(''),
        month_start_date_AD: Joi.string().optional().allow(''),
        month_end_date_AD: Joi.string().optional().allow(''),
        month_start_day_BS: Joi.string().optional().allow(''),
        month_end_day_BS: Joi.string().optional().allow(''),
        month_start_day_AD: Joi.string().optional().allow(''),
        month_end_day_AD: Joi.string().optional().allow(''),
        date_format: Joi.string().optional(),
      }).min(1);
      const validatedData = await schema.validateAsync(data);
      return validatedData;
    } catch (err) {
      return { error: err.message };
    }
  };

  month_data_class = async (data) => {
    try {
      const schema = Joi.object({
        year_label: Joi.string().required(),
        month_name: Joi.string().required(),
        month_start_date_BS: Joi.string().optional().allow(''),
        month_end_date_BS: Joi.string().optional().allow(''),
        month_start_date_AD: Joi.string().optional().allow(''),
        month_end_date_AD: Joi.string().optional().allow(''),
        month_start_day_BS: Joi.string().optional().allow(''),
        month_end_day_BS: Joi.string().optional().allow(''),
        month_start_day_AD: Joi.string().optional().allow(''),
        month_end_day_AD: Joi.string().optional().allow(''),
        date_format: Joi.string().optional(),
      });
      const validatedData = await schema.validateAsync(data);
      console.log(validatedData);
      return validatedData;
    } catch (err) {
      console.log(err);
      return { error: err.message };
    }
  };
}
const month_classificationSVC = new month_classification();
module.exports = month_classificationSVC;
