const router = require("express").Router();

const {
  createTag,
  getAllTags,
  getTagById,
  updateTag,
  deleteTag,
  attachTagToNote,
  detachTagFromNote
} = require("../controllers/TagController");

// ==============================
// Tags CRUD
// ==============================
router.post("/", createTag);          // Create tag
router.get("/", getAllTags);           // List user tags
router.get("/:id", getTagById);        // Single tag
router.put("/:id", updateTag);         // Update tag
router.delete("/:id", deleteTag);      // Delete tag

// ==============================
// Tag ↔ Note Relation
// ==============================
router.post("/:id/notes/:noteId", attachTagToNote);
router.delete("/:id/notes/:noteId", detachTagFromNote);

module.exports = router;
