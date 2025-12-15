const Sequelize = require("sequelize");
const Note = require("../models/note");
const NoteListView = require("../models/note_list_view");
const NoteSummaryView = require("../models/note_summary_view");
const Notebook = require("../models/notebook");
const Tag = require("../models/tag");
const NoteTag = require("../models/noteTag");
const File = require("../models/file");
const Task = require("../models/task");

const NoteController = () => {
  /**
   * @description Create a new note (metadata only, content stored in Firebase)
   * @param req.user - User from authentication middleware
   * @param req.body.title - Note title
   * @param req.body.notebook_id - Notebook ID (optional)
   * @param req.body.firebase_document_id - Firebase document ID (optional, auto-generated if not provided)
   * @returns created note
   */
  const createNote = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { title, notebook_id, firebase_document_id } = req.body;

      if (!title || title.trim() === "") {
        return res.status(400).json({
          success: false,
          msg: "Note title is required",
        });
      }

      // Validate notebook_id if provided
      if (notebook_id) {
        const notebook = await Notebook.findOne({
          where: {
            id: notebook_id,
            user_id: req.user.id,
          },
        });

        if (!notebook) {
          return res.status(404).json({
            success: false,
            msg: "Notebook not found",
          });
        }
      }

      // Generate Firebase document ID (use provided or let Sequelize generate note ID first)
      // Note: Sequelize will auto-generate UUID for id field
      const firebaseDocId = firebase_document_id;

      // Create note (Sequelize will auto-generate UUID for id)
      const note = await Note.create({
        user_id: req.user.id,
        notebook_id: notebook_id || null,
        firebase_document_id: firebaseDocId || null, // Will be set to note.id after creation if not provided
        title: title.trim(),
        pinned: false,
        archived: false,
        trashed: false,
        version: 1,
        synced: false,
      });

      // If firebase_document_id was not provided, use the generated note ID
      if (!firebaseDocId) {
        await note.update({ firebase_document_id: note.id });
        await note.reload(); // Reload to get updated firebase_document_id
      }

      return res.status(201).json({
        success: true,
        msg: "Note created successfully",
        data: {
          note,
        },
      });
    } catch (error) {
      console.error("Create note error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get all notes for the authenticated user
   * @param req.user - User from authentication middleware
   * @param req.body.notebook_id - Optional filter by notebook_id
   * @param req.body.archived - Optional filter by archived status
   * @param req.body.trashed - Optional filter by trashed status
   * @param req.body.pinned - Optional filter by pinned status
   * @returns list of notes
   */
  const getAllNotes = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { notebook_id, archived, trashed, pinned } = req.body || {};
      const whereClause = { user_id: req.user.id };

      if (notebook_id) {
        whereClause.notebook_id = notebook_id;
      }

      if (archived !== undefined) {
        whereClause.archived = archived === true || archived === "true";
      }

      if (trashed !== undefined) {
        whereClause.trashed = trashed === true || trashed === "true";
      }

      if (pinned !== undefined) {
        whereClause.pinned = pinned === true || pinned === "true";
      }

      // Use note_list_view for comprehensive note data with relationships
      const notes = await NoteListView.findAll({
        where: whereClause,
        order: [
          ["pinned", "DESC"],
          ["created_at", "DESC"],
        ],
      });

      return res.status(200).json({
        success: true,
        data: {
          notes,
          count: notes.length,
        },
      });
    } catch (error) {
      console.error("Get all notes error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get a single note by ID
   * @param req.user - User from authentication middleware
   * @param req.body.id - Note ID
   * @returns note details
   */
  const getNoteById = async (req, res) => {
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
          msg: "Note ID is required",
        });
      }

      // Use note_list_view for comprehensive note data
      const note = await NoteListView.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Note not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          note,
        },
      });
    } catch (error) {
      console.error("Get note by ID error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Update note metadata
   * @param req.user - User from authentication middleware
   * @param req.body.id - Note ID
   * @param req.body.title - New title (optional)
   * @param req.body.notebook_id - New notebook ID (optional, null to remove)
   * @param req.body.version - Version number (optional)
   * @returns updated note
   */
  const updateNoteMeta = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { id, title, notebook_id, version } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          msg: "Note ID is required",
        });
      }

      const note = await Note.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Note not found",
        });
      }

      // Validate notebook_id if provided
      if (notebook_id !== undefined && notebook_id !== null) {
        const notebook = await Notebook.findOne({
          where: {
            id: notebook_id,
            user_id: req.user.id,
          },
        });

        if (!notebook) {
          return res.status(404).json({
            success: false,
            msg: "Notebook not found",
          });
        }
      }

      // Update note fields
      if (title !== undefined) note.title = title.trim();
      if (notebook_id !== undefined) note.notebook_id = notebook_id;
      if (version !== undefined) note.version = version;
      note.last_modified = new Date();

      await note.save();

      return res.status(200).json({
        success: true,
        msg: "Note updated successfully",
        data: {
          note,
        },
      });
    } catch (error) {
      console.error("Update note meta error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Delete a note (hard delete)
   * @param req.user - User from authentication middleware
   * @param req.body.id - Note ID
   * @returns success message
   */
  const deleteNote = async (req, res) => {
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
          msg: "Note ID is required",
        });
      }

      const note = await Note.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Note not found",
        });
      }

      // Delete related tasks
      await Task.destroy({
        where: { note_id: id },
      });

      // Delete note-tag relationships
      await NoteTag.destroy({
        where: { note_id: id },
      });

      // Note: Files are not deleted here as they may be referenced elsewhere
      // You may want to delete files separately or handle them differently

      // Delete the note
      await note.destroy();

      return res.status(200).json({
        success: true,
        msg: "Note deleted successfully",
      });
    } catch (error) {
      console.error("Delete note error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Move note to a notebook
   * @param req.user - User from authentication middleware
   * @param req.body.id - Note ID
   * @param req.body.notebookId - Notebook ID
   * @returns updated note
   */
  const moveNoteToNotebook = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { id, notebookId } = req.body;

      if (!id || !notebookId) {
        return res.status(400).json({
          success: false,
          msg: "Note ID and notebook ID are required",
        });
      }

      // Verify note belongs to user
      const note = await Note.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Note not found",
        });
      }

      // Verify notebook belongs to user
      const notebook = await Notebook.findOne({
        where: {
          id: notebookId,
          user_id: req.user.id,
        },
      });

      if (!notebook) {
        return res.status(404).json({
          success: false,
          msg: "Notebook not found",
        });
      }

      // Update note
      await note.update({
        notebook_id: notebookId,
        last_modified: new Date(),
      });

      return res.status(200).json({
        success: true,
        msg: "Note moved to notebook successfully",
        data: {
          note,
        },
      });
    } catch (error) {
      console.error("Move note to notebook error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Pin a note
   * @param req.user - User from authentication middleware
   * @param req.body.id - Note ID
   * @returns updated note
   */
  const pinNote = async (req, res) => {
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
          msg: "Note ID is required",
        });
      }

      const note = await Note.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Note not found",
        });
      }

      await note.update({
        pinned: true,
        last_modified: new Date(),
      });

      return res.status(200).json({
        success: true,
        msg: "Note pinned successfully",
        data: {
          note,
        },
      });
    } catch (error) {
      console.error("Pin note error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Unpin a note
   * @param req.user - User from authentication middleware
   * @param req.body.id - Note ID
   * @returns updated note
   */
  const unpinNote = async (req, res) => {
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
          msg: "Note ID is required",
        });
      }

      const note = await Note.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Note not found",
        });
      }

      await note.update({
        pinned: false,
        last_modified: new Date(),
      });

      return res.status(200).json({
        success: true,
        msg: "Note unpinned successfully",
        data: {
          note,
        },
      });
    } catch (error) {
      console.error("Unpin note error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Archive a note
   * @param req.user - User from authentication middleware
   * @param req.body.id - Note ID
   * @returns updated note
   */
  const archiveNote = async (req, res) => {
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
          msg: "Note ID is required",
        });
      }

      const note = await Note.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Note not found",
        });
      }

      await note.update({
        archived: true,
        pinned: false, // Unpin when archiving
        last_modified: new Date(),
      });

      return res.status(200).json({
        success: true,
        msg: "Note archived successfully",
        data: {
          note,
        },
      });
    } catch (error) {
      console.error("Archive note error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Unarchive a note
   * @param req.user - User from authentication middleware
   * @param req.body.id - Note ID
   * @returns updated note
   */
  const unarchiveNote = async (req, res) => {
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
          msg: "Note ID is required",
        });
      }

      const note = await Note.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Note not found",
        });
      }

      await note.update({
        archived: false,
        last_modified: new Date(),
      });

      return res.status(200).json({
        success: true,
        msg: "Note unarchived successfully",
        data: {
          note,
        },
      });
    } catch (error) {
      console.error("Unarchive note error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Trash a note
   * @param req.user - User from authentication middleware
   * @param req.body.id - Note ID
   * @returns updated note
   */
  const trashNote = async (req, res) => {
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
          msg: "Note ID is required",
        });
      }

      const note = await Note.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Note not found",
        });
      }

      await note.update({
        trashed: true,
        pinned: false, // Unpin when trashing
        archived: false, // Unarchive when trashing
        last_modified: new Date(),
      });

      return res.status(200).json({
        success: true,
        msg: "Note trashed successfully",
        data: {
          note,
        },
      });
    } catch (error) {
      console.error("Trash note error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Restore a note from trash
   * @param req.user - User from authentication middleware
   * @param req.body.id - Note ID
   * @returns updated note
   */
  const restoreNote = async (req, res) => {
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
          msg: "Note ID is required",
        });
      }

      const note = await Note.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Note not found",
        });
      }

      await note.update({
        trashed: false,
        last_modified: new Date(),
      });

      return res.status(200).json({
        success: true,
        msg: "Note restored successfully",
        data: {
          note,
        },
      });
    } catch (error) {
      console.error("Restore note error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Mark note as synced
   * @param req.user - User from authentication middleware
   * @param req.body.id - Note ID
   * @param req.body.version - Optional version number
   * @returns updated note
   */
  const markNoteSynced = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { id, version } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          msg: "Note ID is required",
        });
      }

      const note = await Note.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Note not found",
        });
      }

      await note.update({
        synced: true,
        version: version || note.version,
        last_modified: new Date(),
      });

      return res.status(200).json({
        success: true,
        msg: "Note marked as synced",
        data: {
          note,
        },
      });
    } catch (error) {
      console.error("Mark note synced error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Add a tag to a note
   * @param req.user - User from authentication middleware
   * @param req.body.id - Note ID
   * @param req.body.tagId - Tag ID
   * @returns success message
   */
  const addTagToNote = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { id: noteId, tagId } = req.body;

      if (!noteId || !tagId) {
        return res.status(400).json({
          success: false,
          msg: "Note ID and Tag ID are required",
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

      // Verify tag belongs to user
      const tag = await Tag.findOne({
        where: {
          id: tagId,
          user_id: req.user.id,
        },
      });

      if (!tag) {
        return res.status(404).json({
          success: false,
          msg: "Tag not found",
        });
      }

      // Check if relationship already exists
      const existingRelation = await NoteTag.findOne({
        where: {
          note_id: noteId,
          tag_id: tagId,
        },
      });

      if (existingRelation) {
        return res.status(409).json({
          success: false,
          msg: "Tag is already attached to this note",
        });
      }

      // Create note-tag relationship
      await NoteTag.create({
        note_id: noteId,
        tag_id: tagId,
      });

      return res.status(201).json({
        success: true,
        msg: "Tag added to note successfully",
      });
    } catch (error) {
      console.error("Add tag to note error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Remove a tag from a note
   * @param req.user - User from authentication middleware
   * @param req.body.id - Note ID
   * @param req.body.tagId - Tag ID
   * @returns success message
   */
  const removeTagFromNote = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { id: noteId, tagId } = req.body;

      if (!noteId || !tagId) {
        return res.status(400).json({
          success: false,
          msg: "Note ID and Tag ID are required",
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

      // Verify tag belongs to user
      const tag = await Tag.findOne({
        where: {
          id: tagId,
          user_id: req.user.id,
        },
      });

      if (!tag) {
        return res.status(404).json({
          success: false,
          msg: "Tag not found",
        });
      }

      // Find and delete the relationship
      const relation = await NoteTag.findOne({
        where: {
          note_id: noteId,
          tag_id: tagId,
        },
      });

      if (!relation) {
        return res.status(404).json({
          success: false,
          msg: "Tag is not attached to this note",
        });
      }

      await relation.destroy();

      return res.status(200).json({
        success: true,
        msg: "Tag removed from note successfully",
      });
    } catch (error) {
      console.error("Remove tag from note error:", error);
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
   * @param req.body.id - Note ID
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

      const { id } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          msg: "Note ID is required",
        });
      }

      // Verify note belongs to user
      const note = await Note.findOne({
        where: {
          id,
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
          note_id: id,
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

  /**
   * @description Get all tasks in a note
   * @param req.user - User from authentication middleware
   * @param req.body.id - Note ID
   * @returns list of tasks
   */
  const getNoteTasks = async (req, res) => {
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
          msg: "Note ID is required",
        });
      }

      // Verify note belongs to user
      const note = await Note.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Note not found",
        });
      }

      // Get tasks in this note
      const tasks = await Task.findAll({
        where: {
          note_id: id,
        },
        order: [["sort_order", "ASC"], ["created_at", "ASC"]],
      });

      return res.status(200).json({
        success: true,
        data: {
          note: {
            id: note.id,
            title: note.title,
          },
          tasks,
          count: tasks.length,
        },
      });
    } catch (error) {
      console.error("Get note tasks error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  return {
    createNote,
    getAllNotes,
    getNoteById,
    updateNoteMeta,
    deleteNote,
    moveNoteToNotebook,
    pinNote,
    unpinNote,
    archiveNote,
    unarchiveNote,
    trashNote,
    restoreNote,
    markNoteSynced,
    addTagToNote,
    removeTagFromNote,
    getNoteFiles,
    getNoteTasks,
  };
};

module.exports = NoteController();

