const router = require("express").Router();

const {
  uploadFile,
  getAllFiles,
  getFileById,
  updateFileMeta,
  deleteFile,
  attachFileToNote,
  detachFileFromNote,
  getNoteFiles
} = require("../controllers/FileController");

// ==============================
// Upload / Create
// ==============================
router.post("/", uploadFile);                 // Upload file (unattached or attached)

// ==============================
// Files CRUD (metadata)
// ==============================
router.get("/", getAllFiles);                 // List user files
router.get("/:id", getFileById);              // Single file
router.put("/:id", updateFileMeta);           // Update description, name
router.delete("/:id", deleteFile);            // Delete file

// ==============================
// File ↔ Note
// ==============================
router.put("/:id/note/:noteId", attachFileToNote);
router.delete("/:id/note", detachFileFromNote);

// ==============================
// Note ↔ Files (shortcut)
// ==============================
router.get("/note/:noteId", getNoteFiles);

module.exports = router;
