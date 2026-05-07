// Real-DB unit tests for NoteController. Runs as the seeded dev user.
// Each test sets up a "Test Notebook" so we don't depend on (or modify) any
// other notebooks the dev user might already have.

const { connectDb, closeDb, makeReqRes, DEV_USER_ID } = require("../helpers/dbHelper");
const Notebook = require("../../src/models/notebook");
const Note = require("../../src/models/note");
const NoteController = require("../../src/controllers/NoteController");

const TEST_NOTEBOOK = "Test Notebook";
const TEST_TITLE = "Test Note";

// Order matters: notes reference notebooks via FK.
const cleanup = async () => {
  await Note.destroy({ where: { user_id: DEV_USER_ID, title: TEST_TITLE } });
  await Notebook.destroy({
    where: { user_id: DEV_USER_ID, name: TEST_NOTEBOOK },
  });
};

const setupNotebook = async () =>
  Notebook.create({ user_id: DEV_USER_ID, name: TEST_NOTEBOOK });

beforeAll(connectDb);
afterAll(async () => {
  await cleanup();
  await closeDb();
});
beforeEach(cleanup);

describe("NoteController.createNote", () => {
  it("returns 400 when title is missing", async () => {
    const { req, res } = makeReqRes({ body: {} });

    await NoteController.createNote(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.msg).toMatch(/title is required/i);
  });

  it("creates a note inside the given notebook and returns 201", async () => {
    const notebook = await setupNotebook();

    const { req, res } = makeReqRes({
      body: { title: TEST_TITLE, notebook_id: notebook.id },
    });
    await NoteController.createNote(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.note.title).toBe(TEST_TITLE);
    expect(res.body.data.note.notebook_id).toBe(notebook.id);

    const persisted = await Note.findOne({
      where: { user_id: DEV_USER_ID, title: TEST_TITLE },
    });
    expect(persisted).not.toBeNull();
    expect(persisted.notebook_id).toBe(notebook.id);
  });
});

describe("NoteController.pinNote", () => {
  it("returns 400 when id is missing in params", async () => {
    const { req, res } = makeReqRes({ params: {} });

    await NoteController.pinNote(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("pins an existing note and persists pinned=true", async () => {
    const notebook = await setupNotebook();
    const note = await Note.create({
      user_id: DEV_USER_ID,
      notebook_id: notebook.id,
      firebase_document_id: `fb-test-${Date.now()}`,
      title: TEST_TITLE,
    });
    expect(note.pinned).toBe(false);

    const { req, res } = makeReqRes({ params: { id: note.id } });
    await NoteController.pinNote(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    const reloaded = await Note.findByPk(note.id);
    expect(reloaded.pinned).toBe(true);
  });
});
