const database = require("../config/database");
var cron = require("node-cron");
const moment = require("moment");
const initiatePreData = require("../utils/initiatePreData");
const { syncViews } = require("../config/db.views");

const dbService = (environment, migrate) => {
  const authenticateDB = () => database.authenticate();
  // database.sync();
  const syncDB = () =>
    database.sync({
      force: true,
      alter: false,
    });

  const successfulDBStart = () => {
    console.info(
      "connection to the database has been established successfully"
    );
    initiatePreData();
    cron.schedule("0 0 * * *", async () => {
    
    
    });
    
    let job = cron.schedule("1 14 * * *", async () => {

      // let date = new Date();
      // console.log("calculate_asset_efficiency on", date);
      // try {
      //   let variations = await VariationsModel.findAll();
      //   for (let variation of variations) {
      //     await calculate_variation_efficiency(variation.dataValues.id);
      //   }
      // } catch (e) {
      //   console.error("Error while calculate_asset_efficiency: ", e);
      // }
      console.log("Pending calculate_asset_efficiency for ", date);
    });
    job.start();    
  };




  const errorDBStart = (err) =>
    console.info("unable to connect to the database:", err);

  const wrongEnvironment = () => {
    console.warn(
      `only development, staging, test and production are valid NODE_ENV variables but ${environment} is specified`
    );
    return process.exit(1);
  };

  const startMigrateTrue = async () => {
    try {
      await syncDB();
      await syncViews();
      successfulDBStart();
    } catch (err) {
      errorDBStart(err);
    }
  };

  const startMigrateFalse = async () => {
    try {
      await dropDB();
      await syncDB();
      await syncViews();
      successfulDBStart();
    } catch (err) {
      errorDBStart(err);
    }
  };

  const startDev = async () => {
    try {
      await authenticateDB();

      if (migrate) {
        return startMigrateTrue();
      }

      return startMigrateFalse();
    } catch (err) {
      return errorDBStart(err);
    }
  };

  const startStage = async () => {
    try {
      await authenticateDB();

      if (migrate) {
        return startMigrateTrue();
      }

      return startMigrateFalse();
    } catch (err) {
      return errorDBStart(err);
    }
  };

  const startTest = async () => {
    try {
      await authenticateDB();
      await startMigrateFalse();
    } catch (err) {
      errorDBStart(err);
    }
  };

  const startProd = async () => {
    try {
      await authenticateDB();
      await startMigrateFalse();
    } catch (err) {
      errorDBStart(err);
    }
  };

  const start = async () => {
    switch (environment) {
      case "development":
        await startDev();
        break;
      case "staging":
        await startStage();
        break;
      case "testing":
        await startTest();
        break;
      case "production":
        await startProd();
        break;
      default:
        await wrongEnvironment();
    }
  };

  return {
    start,
  };
};

module.exports = dbService;
