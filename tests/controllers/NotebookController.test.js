// Real-DB unit tests for NotebookController. Runs as the seeded dev user
// (id=1). Uses fixed test data and cleans up only its own rows by name.

const { connectDb, closeDb, makeReqRes, DEV_USER_ID } = require("../helpers/dbHelper");
const Notebook = require("../../src/models/notebook");
const NotebookController = require("../../src/controllers/NotebookController");

const TEST_NAME = "Test Notebook";

const cleanup = async () => {
  await Notebook.destroy({ where: { user_id: DEV_USER_ID, name: TEST_NAME } });
};

beforeAll(connectDb);
afterAll(async () => {
  await cleanup();
  await closeDb();
});
beforeEach(cleanup);

describe("NotebookController.createNotebook", () => {
  it("returns 401 when req.user is missing", async () => {
    const { req, res } = makeReqRes({
      user: undefined,
      body: { name: TEST_NAME },
    });

    await NotebookController.createNotebook(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 when name is missing", async () => {
    const { req, res } = makeReqRes({ body: {} });

    await NotebookController.createNotebook(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.msg).toMatch(/name is required/i);
  });

  it("creates a notebook and returns 201 with the persisted row", async () => {
    const { req, res } = makeReqRes({
      body: { name: TEST_NAME, description: "A test notebook" },
    });

    await NotebookController.createNotebook(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notebook.name).toBe(TEST_NAME);

    const persisted = await Notebook.findOne({
      where: { user_id: DEV_USER_ID, name: TEST_NAME },
    });
    expect(persisted).not.toBeNull();
    expect(persisted.description).toBe("A test notebook");
  });
});

describe("NotebookController.getNotebookById", () => {
  it("returns 400 when id is missing in body", async () => {
    const { req, res } = makeReqRes({ body: {} });

    await NotebookController.getNotebookById(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns the notebook for a valid id", async () => {
    // Setup: create a real notebook directly with the model.
    const notebook = await Notebook.create({
      user_id: DEV_USER_ID,
      name: TEST_NAME,
    });

    const { req, res } = makeReqRes({ body: { id: notebook.id } });
    await NotebookController.getNotebookById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notebook.id).toBe(notebook.id);
    expect(res.body.data.notebook.name).toBe(TEST_NAME);
  });
});
