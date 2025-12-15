const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const File = require("../models/file");
const Note = require("../models/note");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const cloudinaryFolder = process.env.CLOUDINARY_FOLDER || "docify-uploads";

// Configure multer storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const folder = `${cloudinaryFolder}/files`;
    return {
      folder,
      resource_type: "auto", // Auto-detect file type (image, video, raw, etc.)
      public_id: `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`,
    };
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 100, // 100MB file size limit
  },
});

// Middleware for file upload
const uploadMiddleware = upload.single("file");

// Helper function to delete file from Cloudinary
const deleteFileFromCloudinary = async (firebase_storage_path) => {
  try {
    // Extract public_id from Cloudinary URL or path
    const withoutQuery = firebase_storage_path.split("?")[0];
    const parts = withoutQuery.split("/");
    const uploadIndex = parts.findIndex((p) => p === "upload");
    if (uploadIndex === -1) {
      return;
    }
    const pathParts = parts.slice(uploadIndex + 2); // skip "upload" and version segment
    const last = pathParts.pop();
    const baseName = last.split(".")[0];
    const publicId =
      pathParts.length > 0
        ? `${pathParts.join("/")}/${baseName}`
        : baseName;

    await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
    });
  } catch (error) {
    console.error("Error deleting file from Cloudinary:", error);
  }
};

const FileController = () => {
  /**
   * @description Upload a file (unattached or attached to a note)
   * @param req.user - User from authentication middleware
   * @param req.file - Uploaded file from multer
   * @param req.body.note_id - Optional note ID to attach file to
   * @param req.body.description - Optional file description
   * @returns created file record
   */
  const uploadFile = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      // Use multer middleware
      uploadMiddleware(req, res, async (err) => {
        if (err) {
          return res.status(400).json({
            success: false,
            msg: "File upload error",
            error: err.message,
          });
        }

        if (!req.file) {
          return res.status(400).json({
            success: false,
            msg: "No file provided",
          });
        }

        const { note_id, description } = req.body;

        // Validate note_id if provided
        if (note_id) {
          const note = await Note.findOne({
            where: {
              id: note_id,
              user_id: req.user.id,
            },
          });

          if (!note) {
            // Delete uploaded file if note validation fails
            await deleteFileFromCloudinary(req.file.path);
            return res.status(404).json({
              success: false,
              msg: "Note not found",
            });
          }
        }

        // Create file record
        const file = await File.create({
          user_id: req.user.id,
          note_id: note_id || null,
          firebase_storage_path: req.file.path, // Cloudinary URL
          filename: req.file.originalname,
          mime_type: req.file.mimetype,
          size: req.file.size,
          description: description ? description.trim() : null,
        });

        return res.status(201).json({
          success: true,
          msg: "File uploaded successfully",
          data: {
            file,
            url: req.file.path, // Cloudinary URL for direct access
          },
        });
      });
    } catch (error) {
      console.error("Upload file error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get all files for the authenticated user
   * @param req.user - User from authentication middleware
   * @param req.body.note_id - Optional filter by note_id
   * @returns list of files
   */
  const getAllFiles = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { note_id } = req.body || {};
      const whereClause = { user_id: req.user.id };

      if (note_id) {
        whereClause.note_id = note_id;
      }

      const files = await File.findAll({
        where: whereClause,
        order: [["created_at", "DESC"]],
      });

      return res.status(200).json({
        success: true,
        data: {
          files,
          count: files.length,
        },
      });
    } catch (error) {
      console.error("Get all files error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get a single file by ID
   * @param req.user - User from authentication middleware
   * @param req.body.id - File ID
   * @returns file details
   */
  const getFileById = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { id } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          msg: "File ID is required",
        });
      }

      const file = await File.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          msg: "File not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          file,
          url: file.firebase_storage_path, // Cloudinary URL
        },
      });
    } catch (error) {
      console.error("Get file by ID error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Update file metadata
   * @param req.user - User from authentication middleware
   * @param req.body.id - File ID
   * @param req.body.filename - New filename (optional)
   * @param req.body.description - New description (optional)
   * @returns updated file
   */
  const updateFileMeta = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { id } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          msg: "File ID is required",
        });
      }
      const { filename, description } = req.body;

      const file = await File.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          msg: "File not found",
        });
      }

      // Update file fields
      if (filename !== undefined) file.filename = filename.trim();
      if (description !== undefined)
        file.description = description ? description.trim() : null;

      await file.save();

      return res.status(200).json({
        success: true,
        msg: "File metadata updated successfully",
        data: {
          file,
        },
      });
    } catch (error) {
      console.error("Update file meta error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Delete a file
   * @param req.user - User from authentication middleware
   * @param req.body.id - File ID
   * @returns success message
   */
  const deleteFile = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { id } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          msg: "File ID is required",
        });
      }

      const file = await File.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          msg: "File not found",
        });
      }

      // Delete file from Cloudinary
      await deleteFileFromCloudinary(file.firebase_storage_path);

      // Delete file record from database
      await file.destroy();

      return res.status(200).json({
        success: true,
        msg: "File deleted successfully",
      });
    } catch (error) {
      console.error("Delete file error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Attach file to a note
   * @param req.user - User from authentication middleware
   * @param req.body.id - File ID
   * @param req.body.noteId - Note ID
   * @returns updated file
   */
  const attachFileToNote = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { id, noteId } = req.body;

      if (!id || !noteId) {
        return res.status(400).json({
          success: false,
          msg: "File ID and Note ID are required",
        });
      }

      // Verify file belongs to user
      const file = await File.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          msg: "File not found",
        });
      }

      // Verify note belongs to user
      const note = await Note.findOne({
        where: {
          id: noteId,
          user_id: req.user.id,
        },
      });

      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Note not found",
        });
      }

      // Update file
      await file.update({
        note_id: noteId,
      });

      return res.status(200).json({
        success: true,
        msg: "File attached to note successfully",
        data: {
          file,
        },
      });
    } catch (error) {
      console.error("Attach file to note error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Detach file from note
   * @param req.user - User from authentication middleware
   * @param req.body.id - File ID
   * @returns updated file
   */
  const detachFileFromNote = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { id } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          msg: "File ID is required",
        });
      }

      // Verify file belongs to user
      const file = await File.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          msg: "File not found",
        });
      }

      if (!file.note_id) {
        return res.status(400).json({
          success: false,
          msg: "File is not attached to any note",
        });
      }

      // Remove file from note
      await file.update({
        note_id: null,
      });

      return res.status(200).json({
        success: true,
        msg: "File detached from note successfully",
        data: {
          file,
        },
      });
    } catch (error) {
      console.error("Detach file from note error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get all files attached to a note
   * @param req.user - User from authentication middleware
   * @param req.body.noteId - Note ID
   * @returns list of files
   */
  const getNoteFiles = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { noteId } = req.body;

      if (!noteId) {
        return res.status(400).json({
          success: false,
          msg: "Note ID is required",
        });
      }

      // Verify note belongs to user
      const note = await Note.findOne({
        where: {
          id: noteId,
          user_id: req.user.id,
        },
      });

      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Note not found",
        });
      }

      // Get files attached to this note
      const files = await File.findAll({
        where: {
          note_id: noteId,
          user_id: req.user.id,
        },
        order: [["created_at", "DESC"]],
      });

      return res.status(200).json({
        success: true,
        data: {
          note: {
            id: note.id,
            title: note.title,
          },
          files,
          count: files.length,
        },
      });
    } catch (error) {
      console.error("Get note files error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  return {
    uploadFile,
    getAllFiles,
    getFileById,
    updateFileMeta,
    deleteFile,
    attachFileToNote,
    detachFileFromNote,
    getNoteFiles,
  };
};

module.exports = FileController();

