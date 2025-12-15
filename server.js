var express = require("express");
var bodyParser = require("body-parser");
require("dotenv").config();
const config = require("./src/config");
const dbService = require("./src/services/db.service");
const { db: firebaseDb } = require("./src/config/firebase");
const cors = require("cors");
const morgan = require("morgan");
const moment = require("moment");
const environment = process.env.NODE_ENV;

var app = express();

const DB = dbService(environment, config.migrate).start();
// parse application/x-www-form-urlencoded
app.use(cors());
// app.use(express.urlencoded());

morgan.token("date", (req, res, tz) => {
  return moment().tz("Asia/Kolkata").format("YYYY-MM-DD hh:mmA");
});

app.use(morgan(":date :method :url :status"));

app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

app.get("/", function (req, res) {
  res.send("Api working!");
});
require("./src/config/routes").set_routes(app);

//connectDb();
app.listen(config.port, () => {
  if (
    environment !== "production" &&
    environment !== "development" &&
    environment !== "testing"
  ) {
    console.error(
      `NODE_ENV is set to ${environment}, but only production and development are valid.`
    );
    process.exit(1);
  }
  console.info("Firebase Realtime Database initialized");
  return DB;
});
