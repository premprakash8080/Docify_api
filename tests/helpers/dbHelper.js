// Shared helpers for controller unit tests that hit the real database.
//
// Why a helper file: every test file needs the same boilerplate — load
// .env, authenticate Sequelize, register associations, build a fake req/res,
// and reuse the seeded dev user (id=1 from src/config/preData.json) as the
// "logged-in" user.

require("dotenv").config();

const database = require("../../src/config/database");
require("../../src/models/associations"); // register hasMany / belongsTo

// The pre-seeded dev user from src/config/preData.json.
// Tests run as this user so we don't need to log in / handle JWTs.
const DEV_USER_ID = 1;

const connectDb = async () => {
  await database.authenticate();
};

const closeDb = async () => {
  await database.close();
};

// Builds a minimal Express-like { req, res } pair. Defaults `req.user` to
// the seeded dev user so most tests don't have to set it. Pass
// `{ user: undefined }` to test the unauthenticated path.
const makeReqRes = (overrides = {}) => {
  const req = {
    body: {},
    query: {},
    params: {},
    user: { id: DEV_USER_ID },
    ...overrides,
  };
  const res = {
    status: jest.fn(function (code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function (data) {
      this.body = data;
      return this;
    }),
  };
  return { req, res };
};

module.exports = { connectDb, closeDb, makeReqRes, DEV_USER_ID };
