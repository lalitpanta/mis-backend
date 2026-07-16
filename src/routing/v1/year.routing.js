const yearCTRL = require("../../controller/year.controller");

const yearRoute=require('express').Router();

yearRoute.post('/uploadyear', yearCTRL.upload_year);
yearRoute.get('/getyear', yearCTRL.get_year);
yearRoute.get('/getyear/:id', yearCTRL.get_year);
yearRoute.patch('/updateyear/:id', yearCTRL.upload_year);
yearRoute.delete('/deleteyear/:id', yearCTRL.delete_year);

module.exports=yearRoute;