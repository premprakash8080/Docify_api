// Real-DB unit tests for NotificationController. Runs as the seeded dev user.

const { connectDb, closeDb, makeReqRes, DEV_USER_ID } = require("../helpers/dbHelper");
const Notification = require("../../src/models/notification");
const NotificationController = require("../../src/controllers/NotificationController");

const TEST_TITLE = "Test Notification";

const cleanup = async () => {
  await Notification.destroy({
    where: { user_id: DEV_USER_ID, title: TEST_TITLE },
  });
};

beforeAll(connectDb);
afterAll(async () => {
  await cleanup();
  await closeDb();
});
beforeEach(cleanup);

describe("NotificationController.list", () => {
  it("returns the dev user's notifications including a freshly inserted one", async () => {
    await Notification.create({
      user_id: DEV_USER_ID,
      type: "info",
      title: TEST_TITLE,
    });

    const { req, res } = makeReqRes({ query: {} });
    await NotificationController.list(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.success).toBe(true);
    const titles = res.body.data.notifications.map((n) => n.title);
    expect(titles).toContain(TEST_TITLE);
  });
});

describe("NotificationController.markRead", () => {
  it("returns 404 for an id that doesn't belong to the user", async () => {
    const { req, res } = makeReqRes({ params: { id: 999999999 } });

    await NotificationController.markRead(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("marks a notification as read", async () => {
    const notif = await Notification.create({
      user_id: DEV_USER_ID,
      type: "info",
      title: TEST_TITLE,
    });
    expect(notif.is_read).toBe(false);

    const { req, res } = makeReqRes({ params: { id: notif.id } });
    await NotificationController.markRead(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.success).toBe(true);

    const reloaded = await Notification.findByPk(notif.id);
    expect(reloaded.is_read).toBe(true);
    expect(reloaded.read_at).not.toBeNull();
  });
});

describe("NotificationController.remove", () => {
  it("deletes a notification owned by the user", async () => {
    const notif = await Notification.create({
      user_id: DEV_USER_ID,
      type: "info",
      title: TEST_TITLE,
    });

    const { req, res } = makeReqRes({ params: { id: notif.id } });
    await NotificationController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    const gone = await Notification.findByPk(notif.id);
    expect(gone).toBeNull();
  });
});
