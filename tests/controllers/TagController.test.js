// Real-DB unit tests for TagController. Runs as the seeded dev user.

const { connectDb, closeDb, makeReqRes, DEV_USER_ID } = require("../helpers/dbHelper");
const Tag = require("../../src/models/tag");
const TagController = require("../../src/controllers/TagController");

const TEST_NAME = "Test Tag";

const cleanup = async () => {
  await Tag.destroy({ where: { user_id: DEV_USER_ID, name: TEST_NAME } });
};

beforeAll(connectDb);
afterAll(async () => {
  await cleanup();
  await closeDb();
});
beforeEach(cleanup);

describe("TagController.createTag", () => {
  it("returns 400 when name is missing", async () => {
    const { req, res } = makeReqRes({ body: {} });

    await TagController.createTag(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.msg).toMatch(/name is required/i);
  });

  it("creates a tag and returns 201", async () => {
    const { req, res } = makeReqRes({ body: { name: TEST_NAME } });

    await TagController.createTag(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tag.name).toBe(TEST_NAME);

    const persisted = await Tag.findOne({
      where: { user_id: DEV_USER_ID, name: TEST_NAME },
    });
    expect(persisted).not.toBeNull();
  });

  it("returns 409 when the same tag name already exists for the user", async () => {
    // Create the first tag via the controller.
    const first = makeReqRes({ body: { name: TEST_NAME } });
    await TagController.createTag(first.req, first.res);
    expect(first.res.statusCode).toBe(201);

    // Second attempt with the same name should be rejected.
    const second = makeReqRes({ body: { name: TEST_NAME } });
    await TagController.createTag(second.req, second.res);

    expect(second.res.status).toHaveBeenCalledWith(409);
  });
});

describe("TagController.getTagById", () => {
  it("returns 400 when id is missing in query", async () => {
    const { req, res } = makeReqRes({ query: {} });

    await TagController.getTagById(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns the tag for a valid id", async () => {
    const tag = await Tag.create({
      user_id: DEV_USER_ID,
      name: TEST_NAME,
    });

    const { req, res } = makeReqRes({ query: { id: tag.id } });
    await TagController.getTagById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tag.name).toBe(TEST_NAME);
  });
});
