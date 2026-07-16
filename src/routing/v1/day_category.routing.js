const dayCategoryCTRL = require("../../controller/day_category.controller");
const dayCategoryRoute = require("express").Router();

dayCategoryRoute.get("/", dayCategoryCTRL.getAllCategories);
dayCategoryRoute.post("/", dayCategoryCTRL.createCategory);
dayCategoryRoute.patch("/:id", dayCategoryCTRL.updateCategory);
dayCategoryRoute.delete("/:id", dayCategoryCTRL.deleteCategory);

module.exports = dayCategoryRoute;
