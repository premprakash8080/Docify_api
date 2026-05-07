// Real-DB unit tests for TaskController. Runs as the seeded dev user.
// Tests use a far-future date (2099-12-31) to avoid time-slot conflicts
// with any real tasks the dev user may have.

const { connectDb, closeDb, makeReqRes, DEV_USER_ID } = require("../helpers/dbHelper");
const Task = require("../../src/models/task");
const TaskController = require("../../src/controllers/TaskController");

const TEST_LABEL = "Test Task";
const TEST_DATE = "2099-12-31";

const cleanup = async () => {
  await Task.destroy({ where: { user_id: DEV_USER_ID, label: TEST_LABEL } });
};

beforeAll(connectDb);
afterAll(async () => {
  await cleanup();
  await closeDb();
});
beforeEach(cleanup);

describe("TaskController.createTask", () => {
  it("returns 401 when req.user is missing", async () => {
    const { req, res } = makeReqRes({
      user: undefined,
      body: {
        label: TEST_LABEL,
        due_date: TEST_DATE,
        start_time: "09:00",
        end_time: "10:00",
      },
    });

    await TaskController.createTask(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 when required fields are missing", async () => {
    const { req, res } = makeReqRes({ body: { label: TEST_LABEL } });

    await TaskController.createTask(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("creates a standalone task and returns 201", async () => {
    const { req, res } = makeReqRes({
      body: {
        // No note_id — standalone task is allowed.
        label: TEST_LABEL,
        due_date: TEST_DATE,
        start_time: "09:00",
        end_time: "10:00",
      },
    });

    await TaskController.createTask(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.task.label).toBe(TEST_LABEL);

    const persisted = await Task.findOne({
      where: { user_id: DEV_USER_ID, label: TEST_LABEL },
    });
    expect(persisted).not.toBeNull();
    expect(persisted.completed).toBe(false);
  });
});

describe("TaskController.getTaskById", () => {
  it("returns 400 when id is missing in query", async () => {
    const { req, res } = makeReqRes({ query: {} });

    await TaskController.getTaskById(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns the task for a valid id", async () => {
    const task = await Task.create({
      user_id: DEV_USER_ID,
      label: TEST_LABEL,
      start_date: TEST_DATE,
      start_time: "09:00:00",
      end_time: "10:00:00",
    });

    const { req, res } = makeReqRes({ query: { id: task.id } });
    await TaskController.getTaskById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.task.label).toBe(TEST_LABEL);
  });
});
