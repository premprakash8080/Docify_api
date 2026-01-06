const router = require("express").Router();
const jwtVerify = require("../config/jwtVerify");

const {
  createStack,
  getAllStacks,
  getStackById,
  updateStack,
  deleteStack,
  reorderStacks,
  getStackNotebooks,
  getAllStackList
} = require("../controllers/StackController");

// Apply JWT middleware to all routes
router.use(jwtVerify);

// ==============================
// Stacks CRUD
// ==============================
router.post("/", createStack);              // Create stack
router.get("/", getAllStacks);              // List user stacks (no body params needed)
router.post("/:id", getStackById);          // Single stack (POST for body params)
router.put("/:id", updateStack);           // Update stack
router.delete("/:id", deleteStack);         // Delete stack

router.get("/getAllStackList", getAllStackList); // Get stack with id and name
// ==============================
// Stack Ordering
// ==============================
router.put("/reorder", reorderStacks);      // Update sort_order

// ==============================
// Stack ↔ Notebooks
// ==============================
router.post("/:id/notebooks", getStackNotebooks);  // Get stack notebooks (POST for body params)

module.exports = router;
