const monthCTRL = require("../../controller/month_class_data.controller");

const monthRoute= require("express").Router();

monthRoute.post('/uploadmonth', monthCTRL.upload_month);
monthRoute.get('/getmonth', monthCTRL.get_month);
monthRoute.get('/getmonth/:id', monthCTRL.get_month);
monthRoute.patch('/updatemonth/:id', monthCTRL.update_month);
monthRoute.delete('/deletemonth/:id', monthCTRL.delete_month);
module.exports = monthRoute;