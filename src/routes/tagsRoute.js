const router = require("express").Router();
const jwtVerify = require("../config/jwtVerify");

const {
  createTag,
  getAllTags,
  getTagById,
  updateTag,
  deleteTag,
  attachTagToNote,
  detachTagFromNote,
  getColors
} = require("../controllers/TagController");

// ==============================
// Tags CRUD
// ==============================
router.post("/", jwtVerify, createTag);          // Create tag
router.get("/", jwtVerify, getAllTags);           // List user tags
router.get("/colors", jwtVerify, getColors);       // List colors
router.get("/:id", jwtVerify, getTagById);        // Single tag
router.put("/:id", jwtVerify, updateTag);         // Update tag
router.delete("/:id", jwtVerify, deleteTag);      // Delete tag

// ==============================
// Tag ↔ Note Relation
// ==============================
router.post("/:id/notes/:noteId", jwtVerify, attachTagToNote);
router.delete("/:id/notes/:noteId", jwtVerify, detachTagFromNote);

module.exports = router;
