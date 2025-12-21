const Sequelize = require("sequelize");
const { v4: uuidv4 } = require("uuid");
const Note = require("../models/note");
const Notebook = require("../models/notebook");
const Stack = require("../models/stack");
const Tag = require("../models/tag");
const NoteTag = require("../models/noteTag");
const File = require("../models/file");
const Task = require("../models/task");
const Color = require("../models/color");
const User = require("../models/user");
const { resolveNotebookId, getFirebaseDocId, getFormattedNoteResponse } = require("../utils/noteHelpers");
const { getNoteContent: getFirebaseNoteContent, saveNoteContent: saveFirebaseNoteContent, initializeNoteContent } = require("../utils/noteFirestoreHelper");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

      const { title, notebook_id, firebase_document_id } = req.body;

      if (!title || title.trim() === "") {
        return res.status(400).json({
          success: false,
          msg: "Note title is required",
        });
      }

      // Validate notebook_id if provided (not null, undefined, or empty string)
      let validatedNotebookId = null;
      if (notebook_id && notebook_id !== null && notebook_id !== undefined && notebook_id !== '') {
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
        
        validatedNotebookId = notebook_id;
      }

      // Notebook Association Logic:
      // If notebook_id is NOT provided or is null, ensure note is associated with a notebook
      if (validatedNotebookId === null) {
        // Check if user has any notebooks
        const userNotebooks = await Notebook.findAll({
          where: {
            user_id: req.user.id,
          },
          order: [["created_at", "ASC"]], // Oldest first
          limit: 1,
        });

        if (userNotebooks.length > 0) {
          // User has notebooks - use the first (oldest) one
          validatedNotebookId = userNotebooks[0].id;
        } else {
          // User has NO notebooks - create a default "Untitled" notebook
          const defaultNotebook = await Notebook.create({
            user_id: req.user.id,
            name: "Untitled",
            description: null,
            stack_id: null,
            color_id: null,
            sort_order: 0,
          });
          validatedNotebookId = defaultNotebook.id;
        }
      }

      // Generate Firebase document ID (use provided or let Sequelize generate note ID first)
      // Note: Sequelize will auto-generate UUID for id field
      // Ensure firebase_document_id is always a string
      let initialFirebaseDocId = firebase_document_id;
      if (initialFirebaseDocId === undefined || initialFirebaseDocId === null || initialFirebaseDocId === '') {
        // Generate a UUID string (not the Sequelize function reference)
        initialFirebaseDocId = uuidv4();
      } else {
        initialFirebaseDocId = String(initialFirebaseDocId);
      }

      // Create note - always include notebook_id (ensured above)
      const note = await Note.create({
        user_id: req.user.id,
        notebook_id: validatedNotebookId, // Always assigned to a notebook
        firebase_document_id: initialFirebaseDocId,
        title: title.trim(),
        pinned: false,
        archived: false,
        trashed: false,
        version: 1,
        synced: false,
      });

      // Reload note with relationships to format response properly
      const noteWithRelations = await Note.findOne({
        where: {
          id: note.id,
          user_id: req.user.id,
        },
        include: [
          {
            model: Notebook,
            as: "notebook",
            required: false,
            include: [
              {
                model: Stack,
                as: "stack",
                required: false,
                include: [
                  {
                    model: Color,
                    as: "color",
                    attributes: ["id", "name", "hex_code"],
                    required: false,
                  },
                ],
                attributes: ["id", "name", "description", "color_id"],
              },
              {
                model: Color,
                as: "color",
                attributes: ["id", "name", "hex_code"],
                required: false,
              },
            ],
            attributes: ["id", "name", "description", "color_id", "stack_id"],
          },
          {
            model: User,
            as: "user",
            attributes: ["id", "email", "display_name"],
            required: false,
          },
        ],
      });

      if (!noteWithRelations) {
        return res.status(500).json({
          success: false,
          msg: "Failed to retrieve created note",
        });
      }

      const noteData = noteWithRelations.toJSON();

      // Get aggregated counts
      const tagCount = await NoteTag.count({
        where: { note_id: note.id },
      });

      const fileCount = await File.count({
        where: { note_id: note.id },
      });

      const taskStats = await Task.findAll({
        where: { note_id: note.id },
        attributes: [
          [Sequelize.fn("COUNT", Sequelize.col("id")), "task_count"],
          [
            Sequelize.fn(
              "SUM",
              Sequelize.literal("CASE WHEN completed = 1 THEN 1 ELSE 0 END")
            ),
            "completed_task_count",
          ],
        ],
        raw: true,
      });

      const taskCount = taskStats[0]?.task_count || 0;
      const completedTaskCount = taskStats[0]?.completed_task_count || 0;

      // Format response to match getNoteById structure
      const responseData = {
        id: noteData.id,
        user_id: noteData.user_id,
        notebook_id: noteData.notebook_id,
        firebase_document_id: noteData.firebase_document_id,
        title: noteData.title,
        pinned: noteData.pinned,
        archived: noteData.archived,
        trashed: noteData.trashed,
        version: noteData.version,
        synced: noteData.synced,
        created_at: noteData.created_at,
        updated_at: noteData.updated_at,
        last_modified: noteData.last_modified,
        // Notebook information
        notebook_name: noteData.notebook?.name || null,
        notebook_description: noteData.notebook?.description || null,
        notebook_color_id: noteData.notebook?.color_id || null,
        notebook_color_hex: noteData.notebook?.color?.hex_code || null,
        notebook_color_name: noteData.notebook?.color?.name || null,
        // Stack information
        stack_id: noteData.notebook?.stack?.id || null,
        stack_name: noteData.notebook?.stack?.name || null,
        stack_description: noteData.notebook?.stack?.description || null,
        stack_color_id: noteData.notebook?.stack?.color_id || null,
        stack_color_hex: noteData.notebook?.stack?.color?.hex_code || null,
        stack_color_name: noteData.notebook?.stack?.color?.name || null,
        // User information
        user_email: noteData.user?.email || null,
        user_display_name: noteData.user?.display_name || null,
        // Aggregated counts
        tag_count: tagCount,
        file_count: fileCount,
        task_count: parseInt(taskCount) || 0,
        completed_task_count: parseInt(completedTaskCount) || 0,
      };

      return res.status(201).json({
        success: true,
        msg: "Note created successfully",
        data: {
          note: responseData,
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


const refactorCreateNote = async (req, res) => {
  try {
    const { title, notebook_id, firebase_document_id } = req.body;
    const userId = req.user.id;

    if (!title || title.trim() === "") {
      return res.status(400).json({
        success: false,
        msg: "Note title is required",
      });
    }

    // Resolve notebook ID (validate provided or fallback to default)
    const validatedNotebookId = await resolveNotebookId(userId, notebook_id);

    // Get or generate Firebase doc ID
    const initialFirebaseDocId = getFirebaseDocId(firebase_document_id);

    // Create note in SQL
    const note = await Note.create({
      user_id: userId,
      notebook_id: validatedNotebookId,
      firebase_document_id: initialFirebaseDocId,
      title: title.trim(),
      pinned: false,
      archived: false,
      trashed: false,
      version: 1,
      synced: false,
    });

    // Get formatted response with relations and aggregates
    const responseData = await getFormattedNoteResponse(note.id, userId);

    return res.status(201).json({
      success: true,
      msg: "Note created successfully",
      data: { note: responseData },
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
   * @param req.query.notebook_id - Optional filter by notebook_id
   * @param req.query.tag_id - Optional filter by tag_id
   * @param req.query.stack_id - Optional filter by stack_id
   * @param req.query.archived - Optional filter by archived status
   * @param req.query.trashed - Optional filter by trashed status
   * @param req.query.pinned - Optional filter by pinned status
   * @returns list of notes
   */
  const getAllNotes = async (req, res) => {
    try {

      // Accept filters from both query params (standard) and body (for compatibility)
      const queryFilters = req.query || {};
      const bodyFilters = req.body || {};
      const notebook_id = queryFilters.notebook_id || bodyFilters.notebook_id;
      const tag_id = queryFilters.tag_id || bodyFilters.tag_id;
      const stack_id = queryFilters.stack_id || bodyFilters.stack_id;
      const archived = queryFilters.archived !== undefined ? queryFilters.archived : bodyFilters.archived;
      const trashed = queryFilters.trashed !== undefined ? queryFilters.trashed : bodyFilters.trashed;
      const pinned = queryFilters.pinned !== undefined ? queryFilters.pinned : bodyFilters.pinned;
      
      const whereClause = { user_id: req.user.id };

      if (notebook_id) {
        whereClause.notebook_id = notebook_id;
      }

      if (archived !== undefined) {
        whereClause.archived = archived === true || archived === "true" || archived === true;
      }

      if (trashed !== undefined) {
        whereClause.trashed = trashed === true || trashed === "true" || trashed === true;
      }

      if (pinned !== undefined) {
        whereClause.pinned = pinned === true || pinned === "true" || pinned === true;
      }

      // Handle stack-based filtering
      // If stack_id is provided, get all notebooks belonging to that stack
      if (stack_id) {
        // Verify stack belongs to user
        const stack = await Stack.findOne({
          where: {
            id: stack_id,
            user_id: req.user.id,
          },
        });

        if (!stack) {
          return res.status(404).json({
            success: false,
            msg: "Stack not found",
          });
        }

        // Get all notebooks belonging to this stack
        const notebooks = await Notebook.findAll({
          where: {
            stack_id: stack_id,
            user_id: req.user.id,
          },
          attributes: ["id"],
        });

        const notebookIds = notebooks.map((nb) => nb.id);

        if (notebookIds.length === 0) {
          // Stack has no notebooks, return empty result
          return res.status(200).json({
            success: true,
            data: {
              notes: [],
              count: 0,
            },
          });
        }

        // Filter notes by notebook IDs
        if (whereClause.notebook_id) {
          // If notebook_id is also specified, check if it's in the stack
          if (!notebookIds.includes(whereClause.notebook_id)) {
            return res.status(200).json({
              success: true,
              data: {
                notes: [],
                count: 0,
              },
            });
          }
        } else {
          // Filter by all notebooks in the stack
          whereClause.notebook_id = { [Sequelize.Op.in]: notebookIds };
        }
      }

      // Build include array
      const includes = [
        {
          model: Notebook,
          as: "notebook",
          required: false,
          include: [
            {
              model: Stack,
              as: "stack",
              required: false,
              include: [
                {
                  model: Color,
                  as: "color",
                  attributes: ["id", "name", "hex_code"],
                  required: false,
                },
              ],
              attributes: ["id", "name", "description", "color_id"],
            },
            {
              model: Color,
              as: "color",
              attributes: ["id", "name", "hex_code"],
              required: false,
            },
          ],
          attributes: ["id", "name", "description", "color_id", "stack_id"],
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "email", "display_name"],
          required: false,
        },
      ];

      // Handle tag-based filtering
      // If tag_id is provided, include Tag with where clause to filter at database level
      if (tag_id) {
        // Verify tag belongs to user
        const tag = await Tag.findOne({
          where: {
            id: tag_id,
            user_id: req.user.id,
          },
        });

        if (!tag) {
          return res.status(404).json({
            success: false,
            msg: "Tag not found",
          });
        }

        // Include Tag model with where clause to filter notes by tag_id
        // This will use a JOIN through NoteTag table at database level
        includes.push({
          model: Tag,
          as: "tags",
          where: { id: tag_id },
          required: true, // INNER JOIN - only notes with this tag
          attributes: ["id", "name", "color_id"],
          through: {
            attributes: [],
          },
        });
      }

      // Get notes with relationships and aggregated counts
      const notes = await Note.findAll({
        where: whereClause,
        include: includes,
        distinct: true, // Important for JOINs to avoid duplicate rows
        order: [
          ["pinned", "DESC"],
          ["created_at", "DESC"],
        ],
      });

      // Get aggregated counts for each note
      const notesWithCounts = await Promise.all(
        notes.map(async (note) => {
          const noteData = note.toJSON();

          // Get tag count
          const tagCount = await NoteTag.count({
            where: { note_id: note.id },
          });

          // Get file count
          const fileCount = await File.count({
            where: { note_id: note.id },
          });

          // Get task counts
          const taskStats = await Task.findAll({
            where: { note_id: note.id },
            attributes: [
              [Sequelize.fn("COUNT", Sequelize.col("id")), "task_count"],
              [
                Sequelize.fn(
                  "SUM",
                  Sequelize.literal("CASE WHEN completed = 1 THEN 1 ELSE 0 END")
                ),
                "completed_task_count",
              ],
            ],
            raw: true,
          });

          const taskCount = taskStats[0]?.task_count || 0;
          const completedTaskCount = taskStats[0]?.completed_task_count || 0;

          // Build response similar to note_list_view
          return {
            id: noteData.id,
            user_id: noteData.user_id,
            notebook_id: noteData.notebook_id,
            firebase_document_id: noteData.firebase_document_id,
            title: noteData.title,
            pinned: noteData.pinned,
            archived: noteData.archived,
            trashed: noteData.trashed,
            version: noteData.version,
            synced: noteData.synced,
            created_at: noteData.created_at,
            updated_at: noteData.updated_at,
            last_modified: noteData.last_modified,
            // Notebook information
            notebook_name: noteData.notebook?.name || null,
            notebook_description: noteData.notebook?.description || null,
            notebook_color_id: noteData.notebook?.color_id || null,
            notebook_color_hex: noteData.notebook?.color?.hex_code || null,
            notebook_color_name: noteData.notebook?.color?.name || null,
            // Stack information
            stack_id: noteData.notebook?.stack?.id || null,
            stack_name: noteData.notebook?.stack?.name || null,
            stack_description: noteData.notebook?.stack?.description || null,
            stack_color_id: noteData.notebook?.stack?.color_id || null,
            stack_color_hex: noteData.notebook?.stack?.color?.hex_code || null,
            stack_color_name: noteData.notebook?.stack?.color?.name || null,
            // User information
            user_email: noteData.user?.email || null,
            user_display_name: noteData.user?.display_name || null,
            // Aggregated counts
            tag_count: tagCount,
            file_count: fileCount,
            task_count: parseInt(taskCount) || 0,
            completed_task_count: parseInt(completedTaskCount) || 0,
          };
        })
      );

      return res.status(200).json({
        success: true,
        data: {
          notes: notesWithCounts,
          count: notesWithCounts.length,
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

      // Get ID from req.body (POST /notes/getNoteById)
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          msg: "Note ID is required",
        });
      }

      // Get note with relationships, tags, and aggregated counts
      const note = await Note.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
        include: [
          {
            model: Tag,
            as: "tags",
            required: false,
            attributes: ["id", "name", "color_id"],
            through: {
              attributes: [],
            },
          },
          {
            model: Notebook,
            as: "notebook",
            required: false,
            include: [
              {
                model: Stack,
                as: "stack",
                required: false,
                include: [
                  {
                    model: Color,
                    as: "color",
                    attributes: ["id", "name", "hex_code"],
                    required: false,
                  },
                ],
                attributes: ["id", "name", "description", "color_id"],
              },
              {
                model: Color,
                as: "color",
                attributes: ["id", "name", "hex_code"],
                required: false,
              },
            ],
            attributes: ["id", "name", "description", "color_id", "stack_id"],
          },
          {
            model: User,
            as: "user",
            attributes: ["id", "email", "display_name"],
            required: false,
          },
        ],
      });

      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Note not found",
        });
      }

      const noteData = note.toJSON();

      // Get content from Firebase Firestore
      const firebaseDocId = note.firebase_document_id;
      const content = await getFirebaseNoteContent(firebaseDocId);

      // Get aggregated counts
      const tagCount = await NoteTag.count({
        where: { note_id: note.id },
      });

      const fileCount = await File.count({
        where: { note_id: note.id },
      });

      const taskStats = await Task.findAll({
        where: { note_id: note.id },
        attributes: [
          [Sequelize.fn("COUNT", Sequelize.col("id")), "task_count"],
          [
            Sequelize.fn(
              "SUM",
              Sequelize.literal("CASE WHEN completed = 1 THEN 1 ELSE 0 END")
            ),
            "completed_task_count",
          ],
        ],
        raw: true,
      });

      const taskCount = taskStats[0]?.task_count || 0;
      const completedTaskCount = taskStats[0]?.completed_task_count || 0;

      // Format tags as array of tag names (strings)
      const tags = (noteData.tags || []).map((tag) => tag.name);

      // Build response
      const responseData = {
        id: noteData.id,
        user_id: noteData.user_id,
        notebook_id: noteData.notebook_id,
        firebase_document_id: noteData.firebase_document_id,
        title: noteData.title,
        content: content || null,
        pinned: noteData.pinned,
        archived: noteData.archived,
        trashed: noteData.trashed,
        version: noteData.version,
        synced: noteData.synced,
        created_at: noteData.created_at,
        updated_at: noteData.updated_at,
        last_modified: noteData.last_modified,
        // Notebook information
        notebook_name: noteData.notebook?.name || null,
        notebook_description: noteData.notebook?.description || null,
        notebook_color_id: noteData.notebook?.color_id || null,
        notebook_color_hex: noteData.notebook?.color?.hex_code || null,
        notebook_color_name: noteData.notebook?.color?.name || null,
        // Stack information
        stack_id: noteData.notebook?.stack?.id || null,
        stack_name: noteData.notebook?.stack?.name || null,
        stack_description: noteData.notebook?.stack?.description || null,
        stack_color_id: noteData.notebook?.stack?.color_id || null,
        stack_color_hex: noteData.notebook?.stack?.color?.hex_code || null,
        stack_color_name: noteData.notebook?.stack?.color?.name || null,
        // User information
        user_email: noteData.user?.email || null,
        user_display_name: noteData.user?.display_name || null,
        // Aggregated counts
        tag_count: tagCount,
        tags: tags,
        file_count: fileCount,
        task_count: parseInt(taskCount) || 0,
        completed_task_count: parseInt(completedTaskCount) || 0,
      };

      return res.status(200).json({
        success: true,
        data: {
          note: responseData,
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

      // Get ID from route params (PUT /notes/:id)
      const { id } = req.params;
      const { title, notebook_id, version } = req.body;

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

      // Get IDs from route params (PUT /notes/:id/notebook/:notebookId)
      const { id, notebookId } = req.params;

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

      // Get ID from route params (PUT /notes/:id/pin)
      const { id } = req.params;

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

      // Get ID from route params (PUT /notes/:id/unpin)
      const { id } = req.params;

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

      // Get ID from route params (PUT /notes/:id/archive)
      const { id } = req.params;

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

      // Get ID from route params (PUT /notes/:id/unarchive)
      const { id } = req.params;

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

      // Get ID from route params (PUT /notes/:id/trash)
      const { id } = req.params;

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

      // Get ID from route params (PUT /notes/:id/restore)
      const { id } = req.params;

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

      // Get ID from route params (PUT /notes/:id/synced)
      const { id } = req.params;
      const { version } = req.body;

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

      // Get IDs from route params (POST /notes/:id/tags/:tagId)
      const { noteId, tagId } = req.body;

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
   * @param req.body.noteId - Note ID
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

      // Get IDs from route params (DELETE /notes/:id/tags/:tagId)
      const { noteId, tagId } = req.body;

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

      // Get ID from route params (GET /notes/:id/files)
      const { id } = req.params;

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

      // Get ID from route params (GET /notes/:id/tasks)
      const { id } = req.params;

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

  /**
   * @description Get note content from Firebase Firestore
   * @param req.user - User from authentication middleware
   * @param req.params.id - Note ID (UUID)
   * @returns note content from Firestore
   */
  const getNoteContent = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      // Get ID from route params (GET /notes/:id/content)
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({
          success: false,
          msg: "Note ID is required",
        });
      }

      // Verify note exists and belongs to user, include tags and stack
      const note = await Note.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
        attributes: ["id", "title", "notebook_id", "trashed", "created_at", "updated_at", "firebase_document_id"],
        include: [
          {
            model: Tag,
            as: "tags",
            required: false,
            attributes: ["id", "name", "color_id"],
            through: {
              attributes: [],
            },
          },
          {
            model: Notebook,
            as: "notebook",
            required: false,
            include: [
              {
                model: Stack,
                as: "stack",
                required: false,
                attributes: ["id", "name", "description"],
              },
            ],
            attributes: ["id", "name", "stack_id"],
          },
        ],
      });

      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Note not found",
        });
      }

      const noteData = note.toJSON();

      // Get content from Firebase Firestore
      const firebaseDocId = note.firebase_document_id;
      const content = await getFirebaseNoteContent(firebaseDocId);

      // Format tags as array of tag names (empty array if no tags)
      const tags = (noteData.tags || []).map((tag) => tag.name);

      // Get stack name and stack_id from notebook
      const stackName = noteData.notebook?.stack?.name || null;
      const stackId = noteData.notebook?.stack?.id || noteData.notebook?.stack_id || null;

      // Helper function to convert Date to Firebase timestamp format
      const toFirebaseTimestamp = (date) => {
        if (!date) return null;
        const timestamp = date instanceof Date ? date : new Date(date);
        const seconds = Math.floor(timestamp.getTime() / 1000);
        const nanoseconds = (timestamp.getTime() % 1000) * 1000000;
        return {
          _seconds: seconds,
          _nanoseconds: nanoseconds,
        };
      };

      // Build note object with content
      const noteObject = {
        id: noteData.id,
        title: noteData.title || "Untitled",
        content: content?.content.content || "<p></p>",
        notebook_id: noteData.notebook_id || null,
        stack_id: stackId,
        is_trashed: noteData.trashed || false,
        created_at: toFirebaseTimestamp(noteData.created_at),
        updated_at: toFirebaseTimestamp(noteData.updated_at),
      };

      return res.status(200).json({
        success: true,
        data: {
          note: noteObject,
          tags: tags,
          stack_name: stackName,
        },
      });
    } catch (error) {
      console.error("Get note content error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Save/update note content in Firebase Firestore
   * @param req.user - User from authentication middleware
   * @param req.params.id - Note ID (UUID)
   * @param req.body - Content data to save (e.g., { content: "...", title: "..." })
   * @returns success response
   */
  const saveNoteContent = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      // Get ID from route params (PUT /notes/:id/content)
      const { id } = req.params;
      const contentData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          msg: "Note ID is required",
        });
      }

      if (!contentData || typeof contentData !== "object") {
        return res.status(400).json({
          success: false,
          msg: "Content data is required",
        });
      }

      // Verify note exists and belongs to user
      const note = await Note.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
        attributes: ["id", "firebase_document_id", "version"],
      });

      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Note not found",
        });
      }

      const firebaseDocId = note.firebase_document_id;

      // Check if content exists in Firestore, initialize if not
      const existingContent = await getFirebaseNoteContent(firebaseDocId);
      if (existingContent === null) {
        // Initialize note content in Firestore if it doesn't exist
        await initializeNoteContent(firebaseDocId, {
          user_id: req.user.id,
          notebook_id: null, // Can be set if needed
          ...contentData,
        });
      } else {
        // Update existing content
        await saveFirebaseNoteContent(firebaseDocId, contentData);
      }

      // Update the note's version and synced status
      const currentVersion = note.version || 1;
      await Note.update(
        {
          synced: true,
          version: currentVersion + 1,
          last_modified: new Date(),
        },
        {
          where: {
            id: note.id,
            user_id: req.user.id,
          },
        }
      );

      return res.status(200).json({
        success: true,
        msg: "Note content saved successfully",
        data: {
          note_id: note.id,
          firebase_document_id: firebaseDocId,
        },
      });
    } catch (error) {
      console.error("Save note content error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  const uploadNoteImage = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }
      const { note_id } = req.body;
      if (!note_id) {
        return res.status(400).json({
          success: false,
          msg: "Note ID is required",
        });
      }
      const note = await Note.findOne({
        where: {
          id: note_id,
          user_id: req.user.id,
        },
      });
      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Note not found",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          msg: "No image provided",
        });
      }

      const file = await File.create({
        id: uuidv4(),
        user_id: req.user.id,
        note_id: note.id,
        firebase_storage_path: req.file.path,
        filename: req.file.originalname,
        mime_type: req.file.mimetype,
        size: req.file.size,
        description: req.file.public_id,
      });

      return res.status(201).json({
        success: true,
        msg: "Image uploaded successfully",
        data: {
          id: file.id,
          secure_url: req.file.path,
          public_id: req.file.public_id,
        },
      });
    } catch (error) {
      console.error("Upload image error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  const getNoteImages = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const images = await File.findAll({
        where: {
          user_id: req.user.id,
          mime_type: {
            [Sequelize.Op.like]: "image/%",
          },
        },
        order: [["created_at", "DESC"]],
      });

      const imageData = images.map((img) => ({
        id: img.id,
        secure_url: img.firebase_storage_path,
        public_id: img.description,
        filename: img.filename,
        mime_type: img.mime_type,
        size: img.size,
        created_at: img.created_at,
      }));

      return res.status(200).json({
        success: true,
        data: {
          images: imageData,
          count: imageData.length,
        },
      });
    } catch (error) {
      console.error("Get images error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  const deleteNoteImage = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          msg: "Image ID is required",
        });
      }

      const image = await File.findOne({
        where: {
          id,
          user_id: req.user.id,
          mime_type: {
            [Sequelize.Op.like]: "image/%",
          },
        },
      });

      if (!image) {
        return res.status(404).json({
          success: false,
          msg: "Image not found",
        });
      }

      const publicId = image.description;

      try {
        await cloudinary.uploader.destroy(publicId, {
          invalidate: true,
        });
      } catch (cloudinaryError) {
        console.error("Cloudinary delete error:", cloudinaryError);
      }

      await image.destroy();

      return res.status(200).json({
        success: true,
        msg: "Image deleted successfully",
      });
    } catch (error) {
      console.error("Delete image error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get note location (notebook and stack)
   * @param req.user - User from authentication middleware
   * @param req.params.noteId - Note ID
   * @returns note location information
   */
  const getNoteWithStack = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      // Get ID from route params (GET /notes/:noteId/with-stack)
      const { noteId } = req.params;

      if (!noteId) {
        return res.status(400).json({
          success: false,
          msg: "Note ID is required",
        });
      }

      // Get note with notebook and stack relationships
      const note = await Note.findOne({
        where: {
          id: noteId,
          user_id: req.user.id,
        },
        include: [
          {
            model: Notebook,
            as: "notebook",
            required: false,
            include: [
              {
                model: Stack,
                as: "stack",
                required: false,
                attributes: ["id", "name"],
              },
            ],
            attributes: ["id", "name", "stack_id"],
          },
        ],
        attributes: ["id", "title", "notebook_id"],
      });

      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Note not found",
        });
      }

      const noteData = note.toJSON();

      // Build response
      const responseData = {
        note: {
          id: noteData.id,
          title: noteData.title,
          notebookId: noteData.notebook_id || null,
          stackId: noteData.notebook?.stack?.id || noteData.notebook?.stack_id || null,
        },
      };

      return res.status(200).json(responseData);
    } catch (error) {
      console.error("Get note with stack error:", error);
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
    getNoteContent,
    saveNoteContent,
    uploadNoteImage,
    getNoteImages,
    deleteNoteImage,
    getNoteWithStack,
  };
};

module.exports = NoteController();

