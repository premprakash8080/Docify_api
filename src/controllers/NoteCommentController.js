const Note = require("../models/note");
const NoteShare = require("../models/noteShare");
const NoteComment = require("../models/noteComment");
const User = require("../models/user");

const MAX_BODY_CHARS = 5000;

const authorAttrs = ["id", "email", "display_name", "avatar_url"];

/**
 * Returns { canRead, canWrite, isOwner } for the given user against the note.
 * canWrite covers comment authoring (we let any shared user — view OR edit —
 * comment, since comments are an interaction layer rather than a content
 * change). Adjust by checking `share.permission === "edit"` if your team
 * wants stricter rules.
 */
const resolveAccess = async (userId, noteId) => {
  const note = await Note.findOne({
    where: { id: noteId },
    attributes: ["id", "user_id"],
  });
  if (!note) return { note: null, canRead: false, canWrite: false, isOwner: false };
  if (note.user_id === userId) {
    return { note, canRead: true, canWrite: true, isOwner: true };
  }
  const share = await NoteShare.findOne({
    where: { note_id: noteId, shared_with_user_id: userId },
    attributes: ["permission"],
  });
  if (!share) return { note, canRead: false, canWrite: false, isOwner: false };
  return { note, canRead: true, canWrite: true, isOwner: false };
};

/**
 * Format a NoteComment row for API output. Hides the body of soft-deleted
 * comments while keeping the row so child replies still attach.
 */
const formatComment = (row) => {
  const json = row.toJSON ? row.toJSON() : row;
  return {
    id: json.id,
    note_id: json.note_id,
    parent_id: json.parent_id || null,
    user_id: json.user_id,
    body: json.is_deleted ? null : json.body,
    is_deleted: Boolean(json.is_deleted),
    created_at: json.created_at,
    updated_at: json.updated_at,
    author: json.author
      ? {
          id: json.author.id,
          email: json.author.email,
          display_name: json.author.display_name,
          avatar_url: json.author.avatar_url,
        }
      : null,
  };
};

/**
 * GET /api/note-comments?noteId=...
 * Returns a flat list ordered chronologically. The frontend groups by
 * parent_id to render threads.
 */
const list = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, msg: "Unauthorized" });
    }
    const noteId = req.query.noteId;
    if (!noteId) {
      return res
        .status(400)
        .json({ success: false, msg: "noteId is required" });
    }

    const access = await resolveAccess(userId, noteId);
    if (!access.note) {
      return res.status(404).json({ success: false, msg: "Note not found" });
    }
    if (!access.canRead) {
      return res.status(403).json({ success: false, msg: "Forbidden" });
    }

    const rows = await NoteComment.findAll({
      where: { note_id: noteId },
      order: [["created_at", "ASC"]],
      include: [{ model: User, as: "author", attributes: authorAttrs }],
    });

    return res.status(200).json({
      success: true,
      msg: "Comments fetched",
      data: { comments: rows.map(formatComment) },
    });
  } catch (error) {
    console.error("[note-comments/list] error:", error);
    return res.status(500).json({
      success: false,
      msg: "Failed to fetch comments",
      error: error.message,
    });
  }
};

/**
 * POST /api/note-comments
 * Body: { noteId, body, parentId? }
 */
const create = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, msg: "Unauthorized" });
    }

    const { noteId, body, parentId } = req.body || {};
    if (!noteId) {
      return res.status(400).json({ success: false, msg: "noteId is required" });
    }
    if (!body || typeof body !== "string" || !body.trim()) {
      return res
        .status(400)
        .json({ success: false, msg: "Comment body is required" });
    }
    if (body.length > MAX_BODY_CHARS) {
      return res.status(413).json({
        success: false,
        msg: `Comment is too long. Max ${MAX_BODY_CHARS} characters.`,
      });
    }

    const access = await resolveAccess(userId, noteId);
    if (!access.note) {
      return res.status(404).json({ success: false, msg: "Note not found" });
    }
    if (!access.canWrite) {
      return res.status(403).json({ success: false, msg: "Forbidden" });
    }

    // If parentId is provided, validate that the parent exists and is on the
    // same note. This prevents replies from being smuggled across notes.
    let validatedParentId = null;
    if (parentId) {
      const parent = await NoteComment.findOne({
        where: { id: parentId, note_id: noteId },
        attributes: ["id"],
      });
      if (!parent) {
        return res
          .status(400)
          .json({ success: false, msg: "Parent comment not found on this note" });
      }
      validatedParentId = parent.id;
    }

    const created = await NoteComment.create({
      note_id: noteId,
      user_id: userId,
      parent_id: validatedParentId,
      body: body.trim(),
    });

    const withAuthor = await NoteComment.findOne({
      where: { id: created.id },
      include: [{ model: User, as: "author", attributes: authorAttrs }],
    });

    return res.status(201).json({
      success: true,
      msg: "Comment created",
      data: { comment: formatComment(withAuthor) },
    });
  } catch (error) {
    console.error("[note-comments/create] error:", error);
    return res.status(500).json({
      success: false,
      msg: "Failed to create comment",
      error: error.message,
    });
  }
};

/**
 * PUT /api/note-comments/:id   { body }
 * Only the comment author can edit.
 */
const update = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, msg: "Unauthorized" });
    }

    const { id } = req.params;
    const { body } = req.body || {};
    if (!body || typeof body !== "string" || !body.trim()) {
      return res
        .status(400)
        .json({ success: false, msg: "Comment body is required" });
    }
    if (body.length > MAX_BODY_CHARS) {
      return res.status(413).json({
        success: false,
        msg: `Comment is too long. Max ${MAX_BODY_CHARS} characters.`,
      });
    }

    const comment = await NoteComment.findOne({ where: { id } });
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, msg: "Comment not found" });
    }
    if (comment.user_id !== userId) {
      return res
        .status(403)
        .json({ success: false, msg: "Only the author can edit this comment" });
    }
    if (comment.is_deleted) {
      return res
        .status(400)
        .json({ success: false, msg: "Cannot edit a deleted comment" });
    }

    await comment.update({ body: body.trim() });
    const withAuthor = await NoteComment.findOne({
      where: { id },
      include: [{ model: User, as: "author", attributes: authorAttrs }],
    });

    return res.status(200).json({
      success: true,
      msg: "Comment updated",
      data: { comment: formatComment(withAuthor) },
    });
  } catch (error) {
    console.error("[note-comments/update] error:", error);
    return res.status(500).json({
      success: false,
      msg: "Failed to update comment",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/note-comments/:id
 * Soft-delete: clears the body but preserves the row so any replies under it
 * keep their position in the thread. Allowed for the author OR the note owner.
 */
const remove = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, msg: "Unauthorized" });
    }

    const { id } = req.params;
    const comment = await NoteComment.findOne({ where: { id } });
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, msg: "Comment not found" });
    }

    let allowed = comment.user_id === userId;
    if (!allowed) {
      const note = await Note.findOne({
        where: { id: comment.note_id },
        attributes: ["user_id"],
      });
      if (note && note.user_id === userId) allowed = true;
    }
    if (!allowed) {
      return res.status(403).json({ success: false, msg: "Forbidden" });
    }

    await comment.update({ is_deleted: true, body: "" });
    return res.status(200).json({ success: true, msg: "Comment deleted" });
  } catch (error) {
    console.error("[note-comments/remove] error:", error);
    return res.status(500).json({
      success: false,
      msg: "Failed to delete comment",
      error: error.message,
    });
  }
};

module.exports = { list, create, update, remove };
