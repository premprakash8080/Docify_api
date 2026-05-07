require("dotenv").config();
const config = require("./src/config");
const dbService = require("./src/services/db.service");
require("./src/config/firebase");
const app = require("./src/app");

const environment = process.env.NODE_ENV;
const DB = dbService(environment, config.migrate).start();

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
