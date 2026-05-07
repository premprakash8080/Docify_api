// Unit tests for UserController — call controller methods directly against
// the REAL database (loaded from .env). No Sequelize / model mocks. No
// sequelize.sync(). Fixed static test data: every test uses
// email = "test@example.com" / id assigned by the DB.
//
// Repeatability: each test deletes the "test@example.com" user (and its
// auto-created UserSetting row) in beforeEach so the same fixed data works
// across runs.

require("dotenv").config();

const database = require("../../src/config/database");
require("../../src/models/associations"); // register hasMany / belongsTo

const User = require("../../src/models/user");
const UserSetting = require("../../src/models/userSetting");
const UserController = require("../../src/controllers/UserController");

// --- Fixed test data -------------------------------------------------------

const TEST_EMAIL = "test@example.com";
const TEST_PASSWORD = "password123";
const TEST_DISPLAY_NAME = "Test User";

// --- Tiny req/res helper ---------------------------------------------------

const makeReqRes = (overrides = {}) => {
  const req = {
    body: {},
    query: {},
    params: {},
    user: undefined,
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

// Removes the test@example.com user (and its dependent UserSetting row).
// Safe to call when the user doesn't exist.
const removeTestUser = async () => {
  const existing = await User.findOne({ where: { email: TEST_EMAIL } });
  if (!existing) return;
  await UserSetting.destroy({ where: { user_id: existing.id } });
  await existing.destroy();
};

// --- Setup / teardown ------------------------------------------------------

beforeAll(async () => {
  await database.authenticate();
});

afterAll(async () => {
  await removeTestUser();
  await database.close();
});

beforeEach(async () => {
  await removeTestUser();
});

// --- Tests -----------------------------------------------------------------
// keep everything same above...

describe("UserController.register", () => {
  it("returns 400 when email or password is missing", async () => {
    const { req, res } = makeReqRes({ body: { email: TEST_EMAIL } });

    await UserController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toMatchObject({
      success: false,
      msg: "Email and password are required",
    });
  });

  it("creates a user in the DB and returns 201 with a JWT", async () => {
    const { req, res } = makeReqRes({
      body: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        display_name: TEST_DISPLAY_NAME,
      },
    });

    await UserController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(TEST_EMAIL);
    expect(res.body.data.user.display_name).toBe(TEST_DISPLAY_NAME);
    expect(res.body.data.user.auth_provider).toBe("email");
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.expires).toBe("30d");

    const persisted = await User.findOne({ where: { email: TEST_EMAIL } });
    expect(persisted).not.toBeNull();
    expect(persisted.auth_provider).toBe("email");
    expect(persisted.is_active).toBe(true);
    expect(persisted.password_hash).not.toBe(TEST_PASSWORD);
    expect(persisted.password_hash.length).toBeGreaterThan(20);
  });

  it("returns 409 when registering the same email twice", async () => {
    const first = makeReqRes({
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    await UserController.register(first.req, first.res);

    expect(first.res.status).toHaveBeenCalledWith(201);

    const second = makeReqRes({
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    await UserController.register(second.req, second.res);

    expect(second.res.status).toHaveBeenCalledWith(409);
    expect(second.res.body.success).toBe(false);
    expect(second.res.body.msg).toMatch(/already exists/i);
  });
});

describe("UserController.login", () => {
  const registerTestUser = async () => {
    const { req, res } = makeReqRes({
      body: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        display_name: TEST_DISPLAY_NAME,
      },
    });
    await UserController.register(req, res);
    return res.body.data.user;
  };

  it("returns 401 when the user does not exist", async () => {
    const { req, res } = makeReqRes({
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });

    await UserController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body.msg).toBe("Invalid email or password");
  });

  it("returns 401 when the password is wrong", async () => {
    await registerTestUser();

    const { req, res } = makeReqRes({
      body: { email: TEST_EMAIL, password: "wrong-password" },
    });

    await UserController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body.msg).toBe("Invalid email or password");
  });

  it("returns 200 with the user + JWT when credentials are correct", async () => {
    await registerTestUser();

    const { req, res } = makeReqRes({
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });

    await UserController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(TEST_EMAIL);
    expect(res.body.data.token).toEqual(expect.any(String));

    const fresh = await User.findOne({ where: { email: TEST_EMAIL } });
    expect(fresh.last_login_at).not.toBeNull();
  });
});