const router = require("express").Router();

const {
  createStack,
  getAllStacks,
  getStackById,
  updateStack,
  deleteStack,
  reorderStacks,
  getStackNotebooks
} = require("../controllers/StackController");

// ==============================
// Stacks CRUD
// ==============================
router.post("/", createStack);          // Create stack
router.get("/", getAllStacks);           // List user stacks
router.get("/:id", getStackById);        // Single stack
router.put("/:id", updateStack);         // Update stack
router.delete("/:id", deleteStack);      // Delete stack

// ==============================
// Stack Ordering
// ==============================
router.put("/reorder", reorderStacks);   // Update sort_order

// ==============================
// Stack ↔ Notebooks
// ==============================
router.get("/:id/notebooks", getStackNotebooks);

module.exports = router;
