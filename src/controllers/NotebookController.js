const Sequelize = require("sequelize");
const Notebook = require("../models/notebook");
const Note = require("../models/note");
const Stack = require("../models/stack");
const Color = require("../models/color");

const NotebookController = () => {
  /**
   * @description Create a new notebook
   * @param req.user - User from authentication middleware
   * @param req.body.name - Notebook name
   * @param req.body.description - Notebook description (optional)
   * @param req.body.stack_id - Stack ID (optional)
   * @param req.body.color_id - Color ID (optional)
   * @param req.body.sort_order - Sort order (optional)
   * @returns created notebook
   */
  const createNotebook = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { name, description, stack_id, color_id, sort_order } = req.body;

      if (!name || name.trim() === "") {
        return res.status(400).json({
          success: false,
          msg: "Notebook name is required",
        });
      }

      // Validate stack_id if provided
      if (stack_id) {
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

      // Get the highest sort_order for this user's notebooks (in same stack if stack_id provided)
      let maxSortOrder = 0;
      if (sort_order === undefined) {
        const whereClause = { user_id: req.user.id };
        if (stack_id) {
          whereClause.stack_id = stack_id;
        } else {
          whereClause.stack_id = null;
        }

        const maxNotebook = await Notebook.findOne({
          where: whereClause,
          order: [["sort_order", "DESC"]],
          attributes: ["sort_order"],
        });
        maxSortOrder = maxNotebook ? maxNotebook.sort_order + 1 : 0;
      }

      // Create notebook
      const notebook = await Notebook.create({
        user_id: req.user.id,
        name: name.trim(),
        description: description ? description.trim() : null,
        stack_id: stack_id || null,
        color_id: color_id || null,
        sort_order: sort_order !== undefined ? sort_order : maxSortOrder,
      });

      // Fetch notebook with color information
      let notebookWithRelations = await Notebook.findByPk(notebook.id, {
        include: [
          {
            model: Color,
            as: "color",
            attributes: ["id", "name", "hex_code"],
          },
        ],
      });

      // Fetch stack information if stack_id exists
      if (notebook.stack_id) {
        const stack = await Stack.findByPk(notebook.stack_id, {
          include: [
            {
              model: Color,
              as: "color",
              attributes: ["id", "name", "hex_code"],
            },
          ],
          attributes: ["id", "name", "description"],
        });
        notebookWithRelations = notebookWithRelations.toJSON();
        notebookWithRelations.stack = stack;
      }

      return res.status(201).json({
        success: true,
        msg: "Notebook created successfully",
        data: {
          notebook: notebookWithRelations,
        },
      });
    } catch (error) {
      console.error("Create notebook error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get all notebooks for the authenticated user
   * @param req.user - User from authentication middleware
   * @param req.body.stack_id - Optional filter by stack_id
   * @returns list of notebooks
   */
  const getAllNotebooks = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { stack_id } = req.body || {};
      const whereClause = { user_id: req.user.id };

      if (stack_id) {
        whereClause.stack_id = stack_id;
      }

      // Get notebooks with relationships and aggregated counts
      const notebooks = await Notebook.findAll({
        where: whereClause,
        include: [
          {
            model: Color,
            as: "color",
            attributes: ["id", "name", "hex_code"],
            required: false,
          },
          {
            model: Stack,
            as: "stack",
            required: false,
            attributes: ["id", "name", "description"],
          },
        ],
        order: [["sort_order", "ASC"], ["created_at", "DESC"]],
      });

      // Get aggregated counts for each notebook
      const notebooksWithCounts = await Promise.all(
        notebooks.map(async (notebook) => {
          const notebookData = notebook.toJSON();

          // Get note counts
          const noteCounts = await Note.findAll({
            where: {
              notebook_id: notebook.id,
              trashed: false,
            },
            attributes: [
              [Sequelize.fn("COUNT", Sequelize.col("id")), "note_count"],
              [
                Sequelize.fn(
                  "SUM",
                  Sequelize.literal("CASE WHEN pinned = 1 THEN 1 ELSE 0 END")
                ),
                "pinned_notes",
              ],
              [
                Sequelize.fn(
                  "SUM",
                  Sequelize.literal("CASE WHEN archived = 1 THEN 1 ELSE 0 END")
                ),
                "archived_notes",
              ],
            ],
            raw: true,
          });

          const noteCount = noteCounts[0]?.note_count || 0;
          const pinnedNotes = noteCounts[0]?.pinned_notes || 0;
          const archivedNotes = noteCounts[0]?.archived_notes || 0;

          return {
            id: notebookData.id,
            user_id: notebookData.user_id,
            stack_id: notebookData.stack_id,
            name: notebookData.name,
            description: notebookData.description,
            color_id: notebookData.color_id,
            color_hex: notebookData.color?.hex_code || null,
            color_name: notebookData.color?.name || null,
            sort_order: notebookData.sort_order,
            created_at: notebookData.created_at,
            updated_at: notebookData.updated_at,
            // Stack information
            stack_name: notebookData.stack?.name || null,
            stack_description: notebookData.stack?.description || null,
            // Aggregated counts
            note_count: parseInt(noteCount) || 0,
            pinned_notes: parseInt(pinnedNotes) || 0,
            archived_notes: parseInt(archivedNotes) || 0,
          };
        })
      );

      return res.status(200).json({
        success: true,
        data: {
          notebooks: notebooksWithCounts,
          count: notebooksWithCounts.length,
        },
      });
    } catch (error) {
      console.error("Get all notebooks error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get a single notebook by ID
   * @param req.user - User from authentication middleware
   * @param req.body.id - Notebook ID
   * @returns notebook details
   */
  const getNotebookById = async (req, res) => {
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
          msg: "Notebook ID is required",
        });
      }

      // Get notebook with relationships and aggregated counts
      const notebook = await Notebook.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
        include: [
          {
            model: Color,
            as: "color",
            attributes: ["id", "name", "hex_code"],
            required: false,
          },
          {
            model: Stack,
            as: "stack",
            required: false,
            attributes: ["id", "name", "description"],
          },
        ],
      });

      if (!notebook) {
        return res.status(404).json({
          success: false,
          msg: "Notebook not found",
        });
      }

      const notebookData = notebook.toJSON();

      // Get note counts
      const noteCounts = await Note.findAll({
        where: {
          notebook_id: notebook.id,
          trashed: false,
        },
        attributes: [
          [Sequelize.fn("COUNT", Sequelize.col("id")), "note_count"],
          [
            Sequelize.fn(
              "SUM",
              Sequelize.literal("CASE WHEN pinned = 1 THEN 1 ELSE 0 END")
            ),
            "pinned_notes",
          ],
          [
            Sequelize.fn(
              "SUM",
              Sequelize.literal("CASE WHEN archived = 1 THEN 1 ELSE 0 END")
            ),
            "archived_notes",
          ],
        ],
        raw: true,
      });

      const noteCount = noteCounts[0]?.note_count || 0;
      const pinnedNotes = noteCounts[0]?.pinned_notes || 0;
      const archivedNotes = noteCounts[0]?.archived_notes || 0;

      const responseData = {
        id: notebookData.id,
        user_id: notebookData.user_id,
        stack_id: notebookData.stack_id,
        name: notebookData.name,
        description: notebookData.description,
        color_id: notebookData.color_id,
        color_hex: notebookData.color?.hex_code || null,
        color_name: notebookData.color?.name || null,
        sort_order: notebookData.sort_order,
        created_at: notebookData.created_at,
        updated_at: notebookData.updated_at,
        // Stack information
        stack_name: notebookData.stack?.name || null,
        stack_description: notebookData.stack?.description || null,
        // Aggregated counts
        note_count: parseInt(noteCount) || 0,
        pinned_notes: parseInt(pinnedNotes) || 0,
        archived_notes: parseInt(archivedNotes) || 0,
      };

      return res.status(200).json({
        success: true,
        data: {
          notebook: responseData,
        },
      });
    } catch (error) {
      console.error("Get notebook by ID error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Update a notebook
   * @param req.user - User from authentication middleware
   * @param req.body.id - Notebook ID
   * @param req.body.name - New notebook name (optional)
   * @param req.body.description - New description (optional)
   * @param req.body.color_id - New color ID (optional)
   * @param req.body.sort_order - New sort order (optional)
   * @returns updated notebook
   */
  const updateNotebook = async (req, res) => {
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
          msg: "Notebook ID is required",
        });
      }
      const { name, description, color_id, sort_order } = req.body;

      const notebook = await Notebook.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!notebook) {
        return res.status(404).json({
          success: false,
          msg: "Notebook not found",
        });
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

      // Update notebook fields
      if (name !== undefined) notebook.name = name.trim();
      if (description !== undefined)
        notebook.description = description ? description.trim() : null;
      if (color_id !== undefined) notebook.color_id = color_id;
      if (sort_order !== undefined) notebook.sort_order = sort_order;

      await notebook.save();

      // Fetch updated notebook with relationships and aggregated counts
      const updatedNotebook = await Notebook.findByPk(notebook.id, {
        include: [
          {
            model: Color,
            as: "color",
            attributes: ["id", "name", "hex_code"],
            required: false,
          },
          {
            model: Stack,
            as: "stack",
            required: false,
            attributes: ["id", "name", "description"],
          },
        ],
      });

      const notebookData = updatedNotebook.toJSON();

      // Get note counts
      const noteCounts = await Note.findAll({
        where: {
          notebook_id: notebook.id,
          trashed: false,
        },
        attributes: [
          [Sequelize.fn("COUNT", Sequelize.col("id")), "note_count"],
          [
            Sequelize.fn(
              "SUM",
              Sequelize.literal("CASE WHEN pinned = 1 THEN 1 ELSE 0 END")
            ),
            "pinned_notes",
          ],
          [
            Sequelize.fn(
              "SUM",
              Sequelize.literal("CASE WHEN archived = 1 THEN 1 ELSE 0 END")
            ),
            "archived_notes",
          ],
        ],
        raw: true,
      });

      const noteCount = noteCounts[0]?.note_count || 0;
      const pinnedNotes = noteCounts[0]?.pinned_notes || 0;
      const archivedNotes = noteCounts[0]?.archived_notes || 0;

      const responseData = {
        id: notebookData.id,
        user_id: notebookData.user_id,
        stack_id: notebookData.stack_id,
        name: notebookData.name,
        description: notebookData.description,
        color_id: notebookData.color_id,
        color_hex: notebookData.color?.hex_code || null,
        color_name: notebookData.color?.name || null,
        sort_order: notebookData.sort_order,
        created_at: notebookData.created_at,
        updated_at: notebookData.updated_at,
        // Stack information
        stack_name: notebookData.stack?.name || null,
        stack_description: notebookData.stack?.description || null,
        // Aggregated counts
        note_count: parseInt(noteCount) || 0,
        pinned_notes: parseInt(pinnedNotes) || 0,
        archived_notes: parseInt(archivedNotes) || 0,
      };

      return res.status(200).json({
        success: true,
        msg: "Notebook updated successfully",
        data: {
          notebook: responseData,
        },
      });
    } catch (error) {
      console.error("Update notebook error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Delete a notebook
   * @param req.user - User from authentication middleware
   * @param req.body.id - Notebook ID
   * @returns success message
   */
  const deleteNotebook = async (req, res) => {
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
          msg: "Notebook ID is required",
        });
      }

      const notebook = await Notebook.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!notebook) {
        return res.status(404).json({
          success: false,
          msg: "Notebook not found",
        });
      }

      // Check if notebook has notes
      const noteCount = await Note.count({
        where: {
          notebook_id: id,
        },
      });

      if (noteCount > 0) {
        // Option 1: Set notes' notebook_id to null (unnotebook them)
        await Note.update(
          { notebook_id: null },
          {
            where: {
              notebook_id: id,
            },
          }
        );

        // Option 2: Or return error if you want to prevent deletion
        // return res.status(400).json({
        //   success: false,
        //   msg: "Cannot delete notebook with notes. Please move or delete notes first.",
        // });
      }

      // Delete the notebook
      await notebook.destroy();

      return res.status(200).json({
        success: true,
        msg: "Notebook deleted successfully",
      });
    } catch (error) {
      console.error("Delete notebook error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Reorder notebooks (update sort_order for multiple notebooks)
   * @param req.user - User from authentication middleware
   * @param req.body.notebooks - Array of { id, sort_order } objects
   * @param req.body.stack_id - Optional stack_id to filter notebooks
   * @returns success message
   */
  const reorderNotebooks = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { notebooks, stack_id } = req.body;

      if (!notebooks || !Array.isArray(notebooks) || notebooks.length === 0) {
        return res.status(400).json({
          success: false,
          msg: "Notebooks array is required",
        });
      }

      // Validate all notebooks belong to user and update sort_order
      const updatePromises = notebooks.map(async ({ id, sort_order }) => {
        if (!id || sort_order === undefined) {
          throw new Error("Each notebook must have id and sort_order");
        }

        const whereClause = {
          id,
          user_id: req.user.id,
        };

        // If stack_id is provided, validate notebooks belong to that stack
        if (stack_id !== undefined) {
          whereClause.stack_id = stack_id;
        }

        const notebook = await Notebook.findOne({
          where: whereClause,
        });

        if (!notebook) {
          throw new Error(`Notebook with id ${id} not found`);
        }

        return notebook.update({ sort_order });
      });

      await Promise.all(updatePromises);

      return res.status(200).json({
        success: true,
        msg: "Notebooks reordered successfully",
      });
    } catch (error) {
      console.error("Reorder notebooks error:", error);
      return res.status(500).json({
        success: false,
        msg: error.message || "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Move notebook to a stack
   * @param req.user - User from authentication middleware
   * @param req.query.id - Notebook ID
   * @param req.query.stack_id - Stack ID
   * @returns updated notebook
   */
  const moveNotebookToStack = async (req, res) => {
    try {
      const { id, stack_id } = req.body;

      if (!id || !stack_id) {
        return res.status(400).json({
          success: false,
          msg: "Notebook ID and Stack ID are required",
        });
      }

      // Verify notebook belongs to user
      const notebook = await Notebook.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });
      console.log(notebook);

      if (!notebook) {
        return res.status(404).json({
          success: false,
          msg: "Notebook not found",
        });
      }

      // Verify stack belongs to user
      const stack = await Stack.findOne({
        where: {
          id: stack_id,
          user_id: req.user.id,
        },
      });
      console.log(stack);

      if (!stack) {
        return res.status(404).json({
          success: false,
          msg: "Stack not found",
        });
      }

      // Get max sort_order in the target stack
      const maxNotebook = await Notebook.findOne({
        where: {
          stack_id: stack_id,
          user_id: req.user.id,
        },
        order: [["sort_order", "DESC"]],
        attributes: ["sort_order"],
      });

      const newSortOrder = maxNotebook ? maxNotebook.sort_order + 1 : 0;

      // Update notebook
      await notebook.update({
        stack_id: stack_id,
        sort_order: newSortOrder,
      });

      // Fetch updated notebook with color
      let updatedNotebook = await Notebook.findByPk(notebook.id, {
        include: [
          {
            model: Color,
            as: "color",
            attributes: ["id", "name", "hex_code"],
          },
        ],
      });

      updatedNotebook = updatedNotebook.toJSON();

      // Fetch stack information
      const targetStack = await Stack.findByPk(stack_id, {
        include: [
          {
            model: Color,
            as: "color",
            attributes: ["id", "name", "hex_code"],
          },
        ],
        attributes: ["id", "name", "description"],
      });
      updatedNotebook.stack = targetStack;

      return res.status(200).json({
        success: true,
        msg: "Notebook moved to stack successfully",
        data: {
          notebook: updatedNotebook,
        },
      });
    } catch (error) {
      console.error("Move notebook to stack error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Remove notebook from stack (unstack it)
   * @param req.user - User from authentication middleware
   * @param req.body.id - Notebook ID
   * @returns updated notebook
   */
  const removeNotebookFromStack = async (req, res) => {
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
          msg: "Notebook ID is required",
        });
      }

      // Verify notebook belongs to user
      const notebook = await Notebook.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!notebook) {
        return res.status(404).json({
          success: false,
          msg: "Notebook not found",
        });
      }

      if (!notebook.stack_id) {
        return res.status(400).json({
          success: false,
          msg: "Notebook is not in any stack",
        });
      }

      // Get max sort_order for unstacked notebooks
      const maxNotebook = await Notebook.findOne({
        where: {
          stack_id: null,
          user_id: req.user.id,
        },
        order: [["sort_order", "DESC"]],
        attributes: ["sort_order"],
      });

      const newSortOrder = maxNotebook ? maxNotebook.sort_order + 1 : 0;

      // Remove notebook from stack
      await notebook.update({
        stack_id: null,
        sort_order: newSortOrder,
      });

      // Fetch updated notebook with relations
      const updatedNotebook = await Notebook.findByPk(notebook.id, {
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
        msg: "Notebook removed from stack successfully",
        data: {
          notebook: updatedNotebook,
        },
      });
    } catch (error) {
      console.error("Remove notebook from stack error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get all notes in a notebook
   * @param req.user - User from authentication middleware
   * @param req.body.id - Notebook ID
   * @param req.body.archived - Filter by archived status (optional)
   * @param req.body.trashed - Filter by trashed status (optional)
   * @returns list of notes in the notebook
   */
  const getNotebookNotes = async (req, res) => {
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
          msg: "Notebook ID is required",
        });
      }
      const { archived, trashed } = req.body || {};

      // Verify notebook belongs to user
      const notebook = await Notebook.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!notebook) {
        return res.status(404).json({
          success: false,
          msg: "Notebook not found",
        });
      }

      // Build where clause
      const whereClause = {
        notebook_id: id,
        user_id: req.user.id,
      };

      if (archived !== undefined) {
        whereClause.archived = archived === "true";
      }

      if (trashed !== undefined) {
        whereClause.trashed = trashed === "true";
      }

      // Get notes in this notebook
      const notes = await Note.findAll({
        where: whereClause,
        order: [
          ["pinned", "DESC"],
          ["created_at", "DESC"],
        ],
      });

      return res.status(200).json({
        success: true,
        data: {
          notebook: {
            id: notebook.id,
            name: notebook.name,
            description: notebook.description,
          },
          notes,
          count: notes.length,
        },
      });
    } catch (error) {
      console.error("Get notebook notes error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  return {
    createNotebook,
    getAllNotebooks,
    getNotebookById,
    updateNotebook,
    deleteNotebook,
    reorderNotebooks,
    moveNotebookToStack,
    removeNotebookFromStack,
    getNotebookNotes,
  };
};

module.exports = NotebookController();

