const router = require("express").Router();
const jwtVerify = require("../config/jwtVerify");
const {
  list,
  unreadCount,
  markRead,
  markAllRead,
  remove,
} = require("../controllers/NotificationController");

router.use(jwtVerify);

router.get("/", list);
router.get("/unread-count", unreadCount);
router.post("/:id/read", markRead);
router.post("/read-all", markAllRead);
router.delete("/:id", remove);

module.exports = router;
