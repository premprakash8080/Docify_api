const router = require("express").Router();

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

// ==============================
// Notebooks CRUD
// ==============================
router.post("/", createNotebook);            // Create notebook
router.get("/", getAllNotebooks);             // List user notebooks
router.get("/:id", getNotebookById);          // Single notebook
router.put("/:id", updateNotebook);           // Update notebook
router.delete("/:id", deleteNotebook);        // Delete notebook

// ==============================
// Notebook Ordering
// ==============================
router.put("/reorder", reorderNotebooks);     // Update sort_order

// ==============================
// Stack ↔ Notebook
// ==============================
router.put("/:id/stack/:stackId", moveNotebookToStack);
router.delete("/:id/stack", removeNotebookFromStack);

// ==============================
// Notebook ↔ Notes
// ==============================
router.get("/:id/notes", getNotebookNotes);

module.exports = router;
