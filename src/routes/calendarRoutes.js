const router = require("express").Router();
const jwtVerify = require("../config/jwtVerify");
const calendarController = require("../controllers/CalendarController");
const noteController = require("../controllers/NoteController");
const taskController = require("../controllers/TaskController");
const {
  getCalendarEventsByDate,
  getCalendarEventById,
  getCalendarEventsByRange,
  getCalendarItems,
  updateCalendarEvent,
  getExternalEvents,
  createExternalEvent,
} = calendarController();

// Apply JWT middleware to all routes
router.use(jwtVerify);

// ==============================
// Calendar Views (Read Only)
// ==============================

// Get all calendar items (tasks and notes)
router.get("/getCalendarItems", getCalendarItems);

// Get external events (task templates)
router.get("/getExternalEvents", getExternalEvents);

// Create external event (task template)
router.post("/createExternalEvents", createExternalEvent);

// Month / Week / Day view (based on query params: ?date=2024-01-15&view=month)
router.get("/getCalendarEventsByDate", getCalendarEventsByDate);

// Specific calendar event by ID (task ID primary key)
router.get("/getCalendarEventById/:id", getCalendarEventById);

// Custom date range (query params: ?startDate=2024-01-01&endDate=2024-01-31)
router.get("/getCalendarEventsByRange", getCalendarEventsByRange);

// Update calendar event (task) start/end dates using note_id in body
router.put("/updateCalendarEvent", updateCalendarEvent);

// ==============================
// Calendar Details (Read Only)
// ==============================

// Get note details for calendar view (query param: ?id=noteId)
router.get("/getCalendarNoteDetails", noteController.getCalendarNoteDetails);

// Get task details for calendar view (query param: ?id=taskId)
router.get("/getCalendarTaskDetails", taskController.getCalendarTaskDetails);

module.exports = router;
