const dayRoute = require("express").Router();
const dayCTRL = require("../../controller/day_classification.controller");

dayRoute.post('/uploadday', dayCTRL.upload_day);
dayRoute.get('/getday', dayCTRL.get_day);
dayRoute.get('/getday/:id', dayCTRL.get_day);
dayRoute.patch('/updateday/:id', dayCTRL.update_day);
dayRoute.delete('/deleteday/:id', dayCTRL.delete_day);

module.exports = dayRoute;