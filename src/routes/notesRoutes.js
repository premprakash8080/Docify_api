const router = require("express").Router();
const jwtVerify = require("../config/jwtVerify");

const {
  createNote,
  getAllNotes,
  getNoteById,
  updateNoteMeta,
  deleteNote,
  moveNoteToNotebook,

  // Note state
  pinNote,
  unpinNote,
  archiveNote,
  unarchiveNote,
  trashNote,
  restoreNote,

  // Sync
  markNoteSynced,

  // Tags
  addTagToNote,
  removeTagFromNote,

  // Files
  getNoteFiles,

  // Tasks
  getNoteTasks,
  saveNoteContent,
  uploadNoteImage,
  getNoteImages,
  deleteNoteImage,
  getNoteWithStack,
  getNoteContent,
  getNotesName,
} = require("../controllers/NoteController");

// Apply JWT middleware to all routes
router.use(jwtVerify);

// ==============================
// Notes CRUD (metadata only)
// ==============================
router.post("/", createNote);
router.get("/getAllNotes", getAllNotes); // notes?tag_id={tagId}&stack_id={stackId}&notebook_id={notebookId}
router.get("/getNotesName", getNotesName); // Get notes with id and title only
router.post("/getNoteById", getNoteById);
router.put("/:id", updateNoteMeta);
router.delete("/:id", deleteNote);

// ==============================
// Notebook ↔ Note
// ==============================
router.get("/:noteId/with-stack", getNoteWithStack); // Get note location (notebook and stack)
router.put("/:id/notebook/:notebookId", moveNoteToNotebook);

// ==============================
// Note State
// ==============================
router.put("/:id/pin", pinNote);
router.put("/:id/unpin", unpinNote);

router.put("/:id/archive", archiveNote);
router.put("/:id/unarchive", unarchiveNote);

router.put("/:id/trash", trashNote);
router.put("/:id/restore", restoreNote);

// ==============================
// Sync / Versioning
// ==============================
router.put("/:id/synced", markNoteSynced);

// ==============================
// Tags ↔ Notes
// ==============================
router.post("/addTagToNote", addTagToNote);
router.delete("/removeTagFromNote", removeTagFromNote);

// ==============================
// Files & Tasks
// ==============================
router.get("/:id/files", getNoteFiles);
router.get("/:id/tasks", getNoteTasks);

// ==============================
// Note Content
// ==============================
router.put("/:id/content", saveNoteContent);
router.get("/getNoteContent", getNoteContent);

// ==============================
// Note Images
// ==============================
const { uploadNoteImageMiddleware } = require("../handlers/uploadImage");

router.post("/images", uploadNoteImageMiddleware, uploadNoteImage);
router.get("/images", getNoteImages);
router.delete("/images/:id", deleteNoteImage);

module.exports = router;
