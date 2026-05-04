const { Op } = require("sequelize");
const Note = require("../models/note");
const NoteShare = require("../models/noteShare");
const User = require("../models/user");
const Notebook = require("../models/notebook");
const Tag = require("../models/tag");

const ShareController = () => {
  /**
   * @description Share a note with another user by email.
   * @param req.body.noteId    - Note UUID owned by the current user
   * @param req.body.email     - Email of the user to share with
   * @param req.body.permission - "view" | "edit"  (default: "view")
   */
  const shareNote = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, msg: "User not authenticated" });
      }

      const { noteId, email, permission = "view" } = req.body || {};
      if (!noteId || !email) {
        return res.status(400).json({
          success: false,
          msg: "noteId and email are required",
        });
      }
      if (!["view", "edit"].includes(permission)) {
        return res.status(400).json({
          success: false,
          msg: "permission must be 'view' or 'edit'",
        });
      }

      // Verify ownership
      const note = await Note.findOne({
        where: { id: noteId, user_id: req.user.id },
        attributes: ["id", "title", "user_id"],
      });
      if (!note) {
        return res
          .status(404)
          .json({ success: false, msg: "Note not found or not owned by you" });
      }

      // Resolve target user
      const target = await User.findOne({
        where: { email: String(email).trim().toLowerCase() },
        attributes: ["id", "email", "display_name", "avatar_url"],
      });
      if (!target) {
        return res
          .status(404)
          .json({ success: false, msg: "No user is registered with that email" });
      }
      if (target.id === req.user.id) {
        return res
          .status(400)
          .json({ success: false, msg: "You cannot share a note with yourself" });
      }

      // Upsert: if already shared, just update permission.
      const existing = await NoteShare.findOne({
        where: { note_id: noteId, shared_with_user_id: target.id },
      });
      let share;
      if (existing) {
        existing.permission = permission;
        await existing.save();
        share = existing;
      } else {
        share = await NoteShare.create({
          note_id: noteId,
          owner_id: req.user.id,
          shared_with_user_id: target.id,
          permission,
        });
      }

      return res.status(201).json({
        success: true,
        msg: existing ? "Permission updated" : "Note shared",
        data: {
          share: {
            id: share.id,
            note_id: share.note_id,
            permission: share.permission,
            user: {
              id: target.id,
              email: target.email,
              display_name: target.display_name,
              avatar_url: target.avatar_url,
            },
            created_at: share.created_at,
            updated_at: share.updated_at,
          },
        },
      });
    } catch (error) {
      console.error("Share note error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /** @description List all shares for a note (owner only). */
  const getNoteShares = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, msg: "User not authenticated" });
      }
      const { noteId } = req.params;
      if (!noteId) {
        return res.status(400).json({ success: false, msg: "noteId is required" });
      }

      const note = await Note.findOne({
        where: { id: noteId, user_id: req.user.id },
        attributes: ["id"],
      });
      if (!note) {
        return res
          .status(404)
          .json({ success: false, msg: "Note not found or not owned by you" });
      }

      const shares = await NoteShare.findAll({
        where: { note_id: noteId },
        include: [
          {
            model: User,
            as: "sharedWith",
            attributes: ["id", "email", "display_name", "avatar_url"],
          },
        ],
        order: [["created_at", "DESC"]],
      });

      const data = shares.map((s) => {
        const j = s.toJSON();
        return {
          id: j.id,
          note_id: j.note_id,
          permission: j.permission,
          user: j.sharedWith
            ? {
                id: j.sharedWith.id,
                email: j.sharedWith.email,
                display_name: j.sharedWith.display_name,
                avatar_url: j.sharedWith.avatar_url,
              }
            : null,
          created_at: j.created_at,
          updated_at: j.updated_at,
        };
      });

      return res.status(200).json({ success: true, data: { shares: data } });
    } catch (error) {
      console.error("Get note shares error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /** @description Update share permission. Only the note owner can update. */
  const updateSharePermission = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, msg: "User not authenticated" });
      }
      const { shareId } = req.params;
      const { permission } = req.body || {};
      if (!shareId || !permission) {
        return res
          .status(400)
          .json({ success: false, msg: "shareId and permission are required" });
      }
      if (!["view", "edit"].includes(permission)) {
        return res
          .status(400)
          .json({ success: false, msg: "permission must be 'view' or 'edit'" });
      }
      const share = await NoteShare.findOne({
        where: { id: shareId, owner_id: req.user.id },
      });
      if (!share) {
        return res.status(404).json({ success: false, msg: "Share not found" });
      }
      share.permission = permission;
      await share.save();
      return res.status(200).json({
        success: true,
        msg: "Permission updated",
        data: { share: { id: share.id, permission: share.permission } },
      });
    } catch (error) {
      console.error("Update share permission error:", error);
      return res
        .status(500)
        .json({ success: false, msg: "Internal server error", error: error.message });
    }
  };

  /** @description Revoke a share. Owner of the note OR the sharee can revoke. */
  const removeShare = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, msg: "User not authenticated" });
      }
      const { shareId } = req.params;
      if (!shareId) {
        return res.status(400).json({ success: false, msg: "shareId is required" });
      }
      const share = await NoteShare.findOne({
        where: {
          id: shareId,
          [Op.or]: [
            { owner_id: req.user.id },
            { shared_with_user_id: req.user.id },
          ],
        },
      });
      if (!share) {
        return res.status(404).json({ success: false, msg: "Share not found" });
      }
      await share.destroy();
      return res.status(200).json({ success: true, msg: "Share removed" });
    } catch (error) {
      console.error("Remove share error:", error);
      return res
        .status(500)
        .json({ success: false, msg: "Internal server error", error: error.message });
    }
  };

  /** @description List notes shared with the current user. */
  const getSharedWithMe = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, msg: "User not authenticated" });
      }

      const shares = await NoteShare.findAll({
        where: { shared_with_user_id: req.user.id },
        order: [["created_at", "DESC"]],
        include: [
          {
            model: Note,
            as: "note",
            required: true,
            where: { trashed: false },
            attributes: [
              "id",
              "title",
              "notebook_id",
              "created_at",
              "updated_at",
              "pinned",
              "archived",
            ],
            include: [
              {
                model: Notebook,
                as: "notebook",
                required: false,
                attributes: ["id", "name"],
              },
              {
                model: Tag,
                as: "tags",
                required: false,
                attributes: ["id", "name", "color_id"],
                through: { attributes: [] },
              },
            ],
          },
          {
            model: User,
            as: "owner",
            attributes: ["id", "email", "display_name", "avatar_url"],
          },
        ],
      });

      const data = shares.map((s) => {
        const j = s.toJSON();
        return {
          share_id: j.id,
          permission: j.permission,
          shared_at: j.created_at,
          note: j.note
            ? {
                id: j.note.id,
                title: j.note.title,
                notebook_id: j.note.notebook_id,
                notebook_name: j.note.notebook?.name || null,
                created_at: j.note.created_at,
                updated_at: j.note.updated_at,
                tags: j.note.tags || [],
              }
            : null,
          owner: j.owner
            ? {
                id: j.owner.id,
                email: j.owner.email,
                display_name: j.owner.display_name,
                avatar_url: j.owner.avatar_url,
              }
            : null,
        };
      });

      return res.status(200).json({ success: true, data: { shares: data } });
    } catch (error) {
      console.error("Get shared-with-me error:", error);
      return res
        .status(500)
        .json({ success: false, msg: "Internal server error", error: error.message });
    }
  };

  return {
    shareNote,
    getNoteShares,
    updateSharePermission,
    removeShare,
    getSharedWithMe,
  };
};

module.exports = ShareController();
