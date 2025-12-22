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
  getNotebookNotesById,
  getNotebooksWithStacks
} = require("../controllers/NotebookController");

// Apply JWT middleware to all routes
router.use(jwtVerify);

// ==============================
// Notebooks CRUD
// ==============================
router.post("/createNotebook", createNotebook);            // Create notebook
router.get("/with-stacks", getNotebooksWithStacks); // Get notebooks grouped by stacks
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
router.get("/getNotebookNotesById", getNotebookNotesById);  // Get notebook notes (GET with query params: ?id=...&archived=...&trashed=...)

module.exports = router;
