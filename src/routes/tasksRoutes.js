const router = require("express").Router();

const {
  createTask,
  getTaskById,
  updateTask,
  toggleTaskComplete,
  reorderTasks,
  deleteTask,
  getNoteTasks
} = require("../controllers/TaskController");

// ==============================
// Task CRUD
// ==============================
router.post("/", createTask);               // Create task (under a note)
router.get("/:id", getTaskById);            // Get single task
router.put("/:id", updateTask);             // Update label / order
router.put("/:id/toggle", toggleTaskComplete);
router.delete("/:id", deleteTask);

// ==============================
// Task Ordering
// ==============================
router.put("/reorder", reorderTasks);        // Update sort_order in bulk

// ==============================
// Note ↔ Tasks
// ==============================
router.get("/note/:noteId", getNoteTasks);   // All tasks for a note

module.exports = router;
