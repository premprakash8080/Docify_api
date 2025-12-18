const router = require("express").Router();
const jwtVerify = require("../config/jwtVerify");

const {
  createNotebook,
  getAllNotebooks,
  getNotebookById,
  updateNotebook,
  deleteNotebook,
  reorderNotebooks,
  moveNotebookToStack,
  removeNotebookFromStack,
  getNotebookNotes
} = require("../controllers/NotebookController");

// Apply JWT middleware to all routes
router.use(jwtVerify);

// ==============================
// Notebooks CRUD
// ==============================
router.post("/", createNotebook);            // Create notebook
router.post("/list", getAllNotebooks);        // List user notebooks (POST for body params)
router.post("/:id", getNotebookById);         // Single notebook (POST for body params)
router.put("/:id", updateNotebook);           // Update notebook
router.delete("/:id", deleteNotebook);        // Delete notebook

// ==============================
// Notebook Ordering
// ==============================
router.put("/reorder", reorderNotebooks);     // Update sort_order

// ==============================
// Stack ↔ Notebook
// ==============================
router.put("/stack/updateNotebookStack", moveNotebookToStack);
router.delete("/stack/removeNotebookFromStack", removeNotebookFromStack);

// ==============================
// Notebook ↔ Notes
// ==============================
router.post("/:id/notes", getNotebookNotes);  // Get notebook notes (POST for body params)

module.exports = router;
