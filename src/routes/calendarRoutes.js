const router = require("express").Router();

const {
  getCalendarEventsByDate,
  getCalendarEventById,
  getCalendarEventsByRange
} = require("../controllers/CalendarController");

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
