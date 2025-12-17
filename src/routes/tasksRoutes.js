const router = require("express").Router();
const jwtVerify = require("../config/jwtVerify");

const {
  createTask,
  getTaskById,
  updateTask,
  toggleTaskComplete,
  reorderTasks,
  deleteTask,
  getNoteTasks,
  getAllTasks
} = require("../controllers/TaskController");

// Apply JWT middleware to all routes
router.use(jwtVerify);

// ==============================
// Task CRUD
// ==============================
router.post("/", createTask);                    // Create task (under a note)
router.get("/getTaskById", getTaskById);         // Get single task
router.put("/updateTask", updateTask);           // Update label / order
router.put("/toggleTaskComplete", toggleTaskComplete);
router.delete("/deleteTask", deleteTask);
router.get("/getAllTasks", getAllTasks);

// ==============================
// Task Ordering
// ==============================
router.put("/reorder", reorderTasks);            // Update sort_order in bulk

// ==============================
// Note ↔ Tasks
// ==============================
router.get("/getNoteTasks", getNoteTasks);       // All tasks for a note

module.exports = router;
