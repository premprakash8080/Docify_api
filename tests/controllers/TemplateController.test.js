// Real-DB unit tests for TemplateController. Runs as the seeded dev user.

const { connectDb, closeDb, makeReqRes, DEV_USER_ID } = require("../helpers/dbHelper");
const Template = require("../../src/models/template");
const TemplateController = require("../../src/controllers/TemplateController");

const TEST_NAME = "Test Template";

const cleanup = async () => {
  // Only delete user-created test templates — never the seeded "Default
  // Template" with is_system = true.
  await Template.destroy({
    where: { user_id: DEV_USER_ID, name: TEST_NAME, is_system: false },
  });
};

beforeAll(connectDb);
afterAll(async () => {
  await cleanup();
  await closeDb();
});
beforeEach(cleanup);

describe("TemplateController.createTemplate", () => {
  it("returns 400 when name or content is missing", async () => {
    const { req, res } = makeReqRes({ body: { name: TEST_NAME } });

    await TemplateController.createTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.msg).toMatch(/required/i);
  });

  it("creates a user template and returns 201", async () => {
    const { req, res } = makeReqRes({
      body: {
        name: TEST_NAME,
        content: "<p>Agenda</p>",
        description: "Weekly sync",
        content_type: "html",
      },
    });

    await TemplateController.createTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.template.name).toBe(TEST_NAME);
    expect(res.body.data.template.is_system).toBe(false);

    const persisted = await Template.findOne({
      where: { user_id: DEV_USER_ID, name: TEST_NAME },
    });
    expect(persisted).not.toBeNull();
    expect(persisted.content).toBe("<p>Agenda</p>");
  });
});

describe("TemplateController.getTemplateById", () => {
  it("returns the template for a valid id", async () => {
    // Setup via the model to avoid coupling this test to createTemplate.
    const template = await Template.create({
      user_id: DEV_USER_ID,
      name: TEST_NAME,
      content: "Agenda",
      content_type: "tiptap",
      is_system: false,
    });

    const { req, res } = makeReqRes({ query: { templateId: template.id } });
    await TemplateController.getTemplateById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.template.id).toBe(template.id);
    expect(res.body.data.template.name).toBe(TEST_NAME);
  });

  it("returns 404 for a non-existent template id", async () => {
    // UUID that won't be in the DB.
    const { req, res } = makeReqRes({
      query: { templateId: "00000000-0000-0000-0000-000000000000" },
    });

    await TemplateController.getTemplateById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
