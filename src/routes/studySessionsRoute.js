const router = require("express").Router();
const jwtVerify = require("../config/jwtVerify");

const {
  createSession,
  getToday,
  getWeek,
  getStats,
  getTimeline,
  listSessions,
  deleteSession,
} = require("../controllers/StudySessionController");

router.use(jwtVerify);

// Stats endpoints (declared before "/" to avoid conflicts)
router.get("/today", getToday);
router.get("/week", getWeek);
router.get("/stats", getStats);
router.get("/timeline", getTimeline);

// Collection
router.get("/", listSessions);
router.post("/", createSession);

// Item
router.delete("/:id", deleteSession);

module.exports = router;
