// helpers/noteHelpers.js

const Notebook = require("../models/notebook");
const Note = require("../models/note");
const NoteTag = require("../models/noteTag");
const File = require("../models/file");
const Task = require("../models/task");
const Stack = require("../models/stack");
const Color = require("../models/color");
const User = require("../models/user");
const { v4: uuidv4 } = require("uuid");
const Sequelize = require("sequelize");

// Get or create default notebook for a user
const getOrCreateDefaultNotebook = async (userId) => {
  const [notebook] = await Notebook.findAll({
    where: { user_id: userId },
    order: [["created_at", "ASC"]],
    limit: 1,
    attributes: ["id"],
  });

  if (notebook) {
    return notebook.id;
  }

  const defaultNotebook = await Notebook.create({
    user_id: userId,
    name: "Untitled",
    description: null,
    stack_id: null,
    color_id: null,
    sort_order: 0,
    is_default: true, // Assuming you add this column
  });

  return defaultNotebook.id;
};

// Validate and resolve notebook ID (use provided if valid, else default)
const resolveNotebookId = async (userId, providedNotebookId) => {
  if (providedNotebookId) {
    const notebook = await Notebook.findOne({
      where: {
        id: providedNotebookId,
        user_id: userId,
      },
    });
    if (notebook) {
      return providedNotebookId;
    }
  }
  // Fallback to default
  return await getOrCreateDefaultNotebook(userId);
};

// Generate or validate Firebase document ID
const getFirebaseDocId = (providedId) => {
  if (providedId && typeof providedId === "string" && providedId.trim() !== "") {
    return providedId;
  }
  return uuidv4();
};

// Fetch note with full relations and aggregates for response
const getFormattedNoteResponse = async (noteId, userId) => {
  const noteWithRelations = await Note.findOne({
    where: {
      id: noteId,
      user_id: userId,
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
    throw new Error("Note not found");
  }

  const noteData = noteWithRelations.toJSON();

  // Aggregated counts
  const tagCount = await NoteTag.count({ where: { note_id: noteId } });
  const fileCount = await File.count({ where: { note_id: noteId } });
  const taskStats = await Task.findAll({
    where: { note_id: noteId },
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

  // Formatted response data
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
    // Notebook info
    notebook_name: noteData.notebook?.name || null,
    notebook_description: noteData.notebook?.description || null,
    notebook_color_id: noteData.notebook?.color_id || null,
    notebook_color_hex: noteData.notebook?.color?.hex_code || null,
    notebook_color_name: noteData.notebook?.color?.name || null,
    // Stack info
    stack_id: noteData.notebook?.stack?.id || null,
    stack_name: noteData.notebook?.stack?.name || null,
    stack_description: noteData.notebook?.stack?.description || null,
    stack_color_id: noteData.notebook?.stack?.color_id || null,
    stack_color_hex: noteData.notebook?.stack?.color?.hex_code || null,
    stack_color_name: noteData.notebook?.stack?.color?.name || null,
    // User info
    user_email: noteData.user?.email || null,
    user_display_name: noteData.user?.display_name || null,
    // Aggregates
    tag_count: tagCount,
    file_count: fileCount,
    task_count: parseInt(taskCount) || 0,
    completed_task_count: parseInt(completedTaskCount) || 0,
  };
};

module.exports = {
  getOrCreateDefaultNotebook,
  resolveNotebookId,
  getFirebaseDocId,
  getFormattedNoteResponse,
};