const Sequelize = require("sequelize");
const Tag = require("../models/tag");
const Note = require("../models/note");
const NoteTag = require("../models/noteTag");
const Color = require("../models/color");

const TagController = () => {
  /**
   * @description Create a new tag
   * @param req.user - User from authentication middleware
   * @param req.body.name - Tag name
   * @param req.body.color_id - Color ID (optional)
   * @returns created tag
   */
  const createTag = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { name, color_id } = req.body;

      if (!name || name.trim() === "") {
        return res.status(400).json({
          success: false,
          msg: "Tag name is required",
        });
      }

      // Check if tag with same name already exists for this user
      const existingTag = await Tag.findOne({
        where: {
          user_id: req.user.id,
          name: name.trim(),
        },
      });

      if (existingTag) {
        return res.status(409).json({
          success: false,
          msg: "Tag with this name already exists",
        });
      }

      // Validate color_id if provided
      if (color_id) {
        const color = await Color.findByPk(color_id);
        if (!color) {
          return res.status(400).json({
            success: false,
            msg: "Invalid color_id",
          });
        }
      }

      // Create tag
      const tag = await Tag.create({
        user_id: req.user.id,
        name: name.trim(),
        color_id: color_id || null,
      });

      // Fetch tag with color information
      const tagWithColor = await Tag.findByPk(tag.id, {
        include: [
          {
            model: Color,
            as: "color",
            attributes: ["id", "name", "hex_code"],
          },
        ],
      });

      return res.status(201).json({
        success: true,
        msg: "Tag created successfully",
        data: {
          tag: tagWithColor,
        },
      });
    } catch (error) {
      console.error("Create tag error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get all tags for the authenticated user
   * @param req.user - User from authentication middleware
   * @returns list of tags
   */
  const getAllTags = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const tags = await Tag.findAll({
        where: {
          user_id: req.user.id,
        },
        include: [
          {
            model: Color,
            as: "color",
            attributes: ["id", "name", "hex_code"],
          },
        ],
        order: [["created_at", "DESC"]],
      });

      return res.status(200).json({
        success: true,
        data: {
          tags,
          count: tags.length,
        },
      });
    } catch (error) {
      console.error("Get all tags error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get a single tag by ID
   * @param req.user - User from authentication middleware
   * @param req.params.id - Tag ID
   * @returns tag details
   */
  const getTagById = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { id } = req.params;

      const tag = await Tag.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
        include: [
          {
            model: Color,
            as: "color",
            attributes: ["id", "name", "hex_code"],
          },
        ],
      });

      if (!tag) {
        return res.status(404).json({
          success: false,
          msg: "Tag not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          tag,
        },
      });
    } catch (error) {
      console.error("Get tag by ID error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Update a tag
   * @param req.user - User from authentication middleware
   * @param req.params.id - Tag ID
   * @param req.body.name - New tag name (optional)
   * @param req.body.color_id - New color ID (optional)
   * @returns updated tag
   */
  const updateTag = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { id } = req.params;
      const { name, color_id } = req.body;

      const tag = await Tag.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!tag) {
        return res.status(404).json({
          success: false,
          msg: "Tag not found",
        });
      }

      // Check if name is being updated and if it conflicts with existing tag
      if (name && name.trim() !== tag.name) {
        const existingTag = await Tag.findOne({
          where: {
            user_id: req.user.id,
            name: name.trim(),
            id: { [Sequelize.Op.ne]: id },
          },
        });

        if (existingTag) {
          return res.status(409).json({
            success: false,
            msg: "Tag with this name already exists",
          });
        }
      }

      // Validate color_id if provided
      if (color_id !== undefined) {
        if (color_id !== null) {
          const color = await Color.findByPk(color_id);
          if (!color) {
            return res.status(400).json({
              success: false,
              msg: "Invalid color_id",
            });
          }
        }
      }

      // Update tag
      if (name !== undefined) tag.name = name.trim();
      if (color_id !== undefined) tag.color_id = color_id;

      await tag.save();

      // Fetch updated tag with color information
      const updatedTag = await Tag.findByPk(tag.id, {
        include: [
          {
            model: Color,
            as: "color",
            attributes: ["id", "name", "hex_code"],
          },
        ],
      });

      return res.status(200).json({
        success: true,
        msg: "Tag updated successfully",
        data: {
          tag: updatedTag,
        },
      });
    } catch (error) {
      console.error("Update tag error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Delete a tag
   * @param req.user - User from authentication middleware
   * @param req.params.id - Tag ID
   * @returns success message
   */
  const deleteTag = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { id } = req.params;

      const tag = await Tag.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!tag) {
        return res.status(404).json({
          success: false,
          msg: "Tag not found",
        });
      }

      // Delete all note-tag relationships first
      await NoteTag.destroy({
        where: {
          tag_id: id,
        },
      });

      // Delete the tag
      await tag.destroy();

      return res.status(200).json({
        success: true,
        msg: "Tag deleted successfully",
      });
    } catch (error) {
      console.error("Delete tag error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Attach a tag to a note
   * @param req.user - User from authentication middleware
   * @param req.params.id - Tag ID
   * @param req.params.noteId - Note ID
   * @returns success message
   */
  const attachTagToNote = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { id: tagId, noteId } = req.params;

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
        msg: "Tag attached to note successfully",
      });
    } catch (error) {
      console.error("Attach tag to note error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Detach a tag from a note
   * @param req.user - User from authentication middleware
   * @param req.params.id - Tag ID
   * @param req.params.noteId - Note ID
   * @returns success message
   */
  const detachTagFromNote = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { id: tagId, noteId } = req.params;

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
        msg: "Tag detached from note successfully",
      });
    } catch (error) {
      console.error("Detach tag from note error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  return {
    createTag,
    getAllTags,
    getTagById,
    updateTag,
    deleteTag,
    attachTagToNote,
    detachTagFromNote,
  };
};

module.exports = TagController();

