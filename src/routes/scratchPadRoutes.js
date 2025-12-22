const router = require("express").Router();
const jwtVerify = require("../config/jwtVerify");
const scratchPadController = require("../controllers/ScratchPadController");

const {
  getScratchPad,
  updateScratchPad,
  clearScratchPad,
} = scratchPadController;

// Apply JWT middleware to all routes
router.use(jwtVerify);

// ==============================
// Scratch Pad APIs
// ==============================

// Get scratch pad content
router.get("/", getScratchPad);

// Update scratch pad content
router.put("/", updateScratchPad);

// Clear/reset scratch pad
router.delete("/", clearScratchPad);

module.exports = router;

