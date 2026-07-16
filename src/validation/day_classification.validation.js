const Joi = require("joi");

class day_classification {
  Put_day_data = async (data) => {
    try {
      const schema = Joi.object({
        day_type: Joi.string().required(),
        category_id: Joi.string().guid().optional(),
      });
      const validatedData = await schema.validateAsync(data);
      console.log(validatedData);
      return validatedData;
    } catch (err) {
      return { error: err.message };
    }
    //catch ends here
  };

  update_day_data = async (data) => {
    try {
      const schema = Joi.object({
        day_type: Joi.string().optional(),
        category_id: Joi.string().guid().optional(),
      }).min(1); // At least 1 field must be provided
      const validatedData = await schema.validateAsync(data);
      return validatedData;
    } catch (err) {
      return { error: err.message };
    } 
  };
}
const day_classificationSVC = new day_classification();
module.exports = day_classificationSVC;
