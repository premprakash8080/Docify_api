const router = require("express").Router();
const jwtVerify = require("../config/jwtVerify");
const {
  shareNote,
  getNoteShares,
  updateSharePermission,
  removeShare,
  getSharedWithMe,
} = require("../controllers/ShareController");

router.use(jwtVerify);

// ==============================
// Note shares (note owner perspective)
// ==============================
router.post("/", shareNote);                       // Share with email + permission
router.get("/note/:noteId", getNoteShares);        // List shares for a note
router.put("/:shareId", updateSharePermission);    // Update permission
router.delete("/:shareId", removeShare);           // Revoke

// ==============================
// Shared-with-me (sharee perspective)
// ==============================
router.get("/with-me", getSharedWithMe);

module.exports = router;
