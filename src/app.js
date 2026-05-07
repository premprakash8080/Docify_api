const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const morgan = require("morgan");
const moment = require("moment");

const app = express();

app.use(cors());

morgan.token("date", () => moment().tz("Asia/Kolkata").format("YYYY-MM-DD hh:mmA"));
app.use(morgan(":date :method :url :status"));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("Api working!");
});

require("./config/routes").set_routes(app);

module.exports = app;
