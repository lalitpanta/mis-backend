const Joi = require("joi");

class year {
  year = async (data) => {
    try {
      const schema = Joi.object({
        year_label: Joi.string().required(),
        year_label_AD: Joi.string().required(),
        year_label_BS: Joi.string().required(),
        start_date_AD: Joi.string().required(),
        end_date_AD: Joi.string().required(),
        start_date_BS: Joi.string().required(),
        end_date_BS: Joi.string().required(),
        start_date: Joi.any(), // fallback
        end_date: Joi.any(),   // fallback
        is_current: Joi.boolean().optional(),
      });
      return await schema.validateAsync(data);
    } catch (err) {
      throw err;
    }
  };
  //year ends here
}
const yearSVC = new year();
module.exports = yearSVC;
