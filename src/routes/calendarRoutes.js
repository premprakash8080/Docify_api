const router = require("express").Router();
const jwtVerify = require("../config/jwtVerify");

const {
  getCalendarEventsByDate,
  getCalendarEventById,
  getCalendarEventsByRange
} = require("../controllers/CalendarController");

// Apply JWT middleware to all routes
router.use(jwtVerify);

// ==============================
// Calendar Views (Read Only)
// ==============================

// Month / Week / Day view (based on query params)
router.get("/getCalendarEventsByDate", getCalendarEventsByDate);

// Specific calendar event
router.get("/getCalendarEventById/:id", getCalendarEventById);

// Custom date range
router.get("/getCalendarEventsByRange", getCalendarEventsByRange);

module.exports = router;
