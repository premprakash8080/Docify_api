const Sequelize = require("sequelize");
const Stack = require("../models/stack");
const Notebook = require("../models/notebook");
const Note = require("../models/note");
const Color = require("../models/color");

const StackController = () => {
  /**
   * @description Create a new stack
   * @param req.user - User from authentication middleware
   * @param req.body.name - Stack name
   * @param req.body.description - Stack description (optional)
   * @param req.body.color_id - Color ID (optional)
   * @param req.body.sort_order - Sort order (optional)
   * @returns created stack
   */
  const createStack = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { name, description, color_id, sort_order } = req.body;

      if (!name || name.trim() === "") {
        return res.status(400).json({
          success: false,
          msg: "Stack name is required",
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

      // Get the highest sort_order for this user's stacks
      let maxSortOrder = 0;
      if (sort_order === undefined) {
        const maxStack = await Stack.findOne({
          where: { user_id: req.user.id },
          order: [["sort_order", "DESC"]],
          attributes: ["sort_order"],
        });
        maxSortOrder = maxStack ? maxStack.sort_order + 1 : 0;
      }

      // Create stack
      const stack = await Stack.create({
        user_id: req.user.id,
        name: name.trim(),
        description: description ? description.trim() : null,
        color_id: color_id || null,
        sort_order: sort_order !== undefined ? sort_order : maxSortOrder,
      });

      // Fetch stack with color information
      const stackWithColor = await Stack.findByPk(stack.id, {
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
        msg: "Stack created successfully",
        data: {
          stack: stackWithColor,
        },
      });
    } catch (error) {
      console.error("Create stack error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get all stacks for the authenticated user with nested notebooks and notes
   * @param req.user - User from authentication middleware
   * @returns Evernote-style nested structure: Stack → Notebooks → Notes (lightweight metadata)
   */
  const getAllStacks = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      // Fetch stacks with nested notebooks and notes using core models
      const stacks = await Stack.findAll({
        where: {
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
            model: Notebook,
            as: "notebooks",
            where: {
              user_id: req.user.id,
            },
            required: false,
            include: [
              {
                model: Color,
                as: "color",
                attributes: ["id", "name", "hex_code"],
                required: false,
              },
              {
                model: Note,
                as: "notes",
                attributes: [
                  "id",
                  "title",
                  "pinned",
                  "archived",
                  "trashed",
                  "updated_at",
                  "last_modified",
                  "created_at",
                ],
                where: {
                  user_id: req.user.id,
                  trashed: false, // Exclude trashed notes by default
                },
                required: false,
                separate: true, // Use separate query for better performance
                order: [
                  ["pinned", "DESC"],
                  ["last_modified", "DESC"],
                  ["updated_at", "DESC"],
                  ["created_at", "DESC"],
                ],
              },
            ],
            order: [
              ["sort_order", "ASC"],
              ["created_at", "DESC"],
            ],
          },
        ],
        order: [
          ["sort_order", "ASC"],
          ["created_at", "DESC"],
        ],
      });

      // Transform the data to frontend-friendly structure
      const transformedStacks = stacks.map((stack) => {
        const stackData = stack.toJSON();

        return {
          id: stackData.id,
          name: stackData.name,
          description: stackData.description,
          sort_order: stackData.sort_order,
          created_at: stackData.created_at,
          updated_at: stackData.updated_at,
          color: stackData.color
            ? {
              id: stackData.color.id,
              name: stackData.color.name,
              hex_code: stackData.color.hex_code,
            }
            : null,
          notebooks: (stackData.notebooks || []).map((notebook) => ({
            id: notebook.id,
            name: notebook.name,
            stack_id: notebook.stack_id,
            description: notebook.description,
            sort_order: notebook.sort_order,
            created_at: notebook.created_at,
            updated_at: notebook.updated_at,
            color: notebook.color
              ? {
                id: notebook.color.id,
                name: notebook.color.name,
                hex_code: notebook.color.hex_code,
              }
              : null,
            notes: (notebook.notes || []).map((note) => ({
              id: note.id,
              title: note.title,
              pinned: note.pinned,
              archived: note.archived,
              updated_at: note.last_modified || note.updated_at || note.created_at,
            })),
            note_count: notebook.notes ? notebook.notes.length : 0,
          })),
          notebook_count: stackData.notebooks ? stackData.notebooks.length : 0,
        };
      });

      return res.status(200).json({
        success: true,
        data: {
          stacks: transformedStacks,
          count: transformedStacks.length,
        },
      });
    } catch (error) {
      console.error("Get all stacks error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get a single stack by ID
   * @param req.user - User from authentication middleware
   * @param req.body.id - Stack ID
   * @returns stack details
   */
  const getStackById = async (req, res) => {
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
          msg: "Stack ID is required",
        });
      }

      // Find stack with color information
      const stack = await Stack.findOne({
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
        ],
      });

      if (!stack) {
        return res.status(404).json({
          success: false,
          msg: "Stack not found",
        });
      }

      // Get notebook count and total notes count
      const notebookCount = await Notebook.count({
        where: {
          stack_id: id,
          user_id: req.user.id,
        },
      });

      // Count notes in notebooks that belong to this stack
      const notebooksInStack = await Notebook.findAll({
        where: {
          stack_id: id,
          user_id: req.user.id,
        },
        attributes: ["id"],
      });

      const notebookIds = notebooksInStack.map((nb) => nb.id);
      const totalNotes = notebookIds.length > 0
        ? await Note.count({
          where: {
            notebook_id: {
              [Sequelize.Op.in]: notebookIds,
            },
            user_id: req.user.id,
            trashed: false,
          },
        })
        : 0;

      const stackData = stack.toJSON();
      const responseData = {
        ...stackData,
        notebook_count: notebookCount,
        total_notes: totalNotes,
      };

      return res.status(200).json({
        success: true,
        data: {
          stack: responseData,
        },
      });
    } catch (error) {
      console.error("Get stack by ID error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Update a stack
   * @param req.user - User from authentication middleware
   * @param req.body.id - Stack ID
   * @param req.body.name - New stack name (optional)
   * @param req.body.description - New description (optional)
   * @param req.body.color_id - New color ID (optional)
   * @param req.body.sort_order - New sort order (optional)
   * @returns updated stack
   */
  const updateStack = async (req, res) => {
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
          msg: "Stack ID is required",
        });
      }
      const { name, description, color_id, sort_order } = req.body;

      const stack = await Stack.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!stack) {
        return res.status(404).json({
          success: false,
          msg: "Stack not found",
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

      // Update stack fields
      if (name !== undefined) stack.name = name.trim();
      if (description !== undefined)
        stack.description = description ? description.trim() : null;
      if (color_id !== undefined) stack.color_id = color_id;
      if (sort_order !== undefined) stack.sort_order = sort_order;

      await stack.save();

      // Fetch updated stack with color information
      const updatedStack = await Stack.findByPk(stack.id, {
        include: [
          {
            model: Color,
            as: "color",
            attributes: ["id", "name", "hex_code"],
            required: false,
          },
        ],
      });

      // Get notebook count and total notes count
      const notebookCount = await Notebook.count({
        where: {
          stack_id: stack.id,
          user_id: req.user.id,
        },
      });

      const totalNotes = await Note.count({
        include: [
          {
            model: Notebook,
            as: "notebook",
            where: {
              stack_id: stack.id,
              user_id: req.user.id,
            },
            required: true,
          },
        ],
        where: {
          trashed: false,
        },
      });

      const stackData = updatedStack.toJSON();
      const responseData = {
        ...stackData,
        notebook_count: notebookCount,
        total_notes: totalNotes,
      };

      return res.status(200).json({
        success: true,
        msg: "Stack updated successfully",
        data: {
          stack: responseData,
        },
      });
    } catch (error) {
      console.error("Update stack error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Delete a stack
   * @param req.user - User from authentication middleware
   * @param req.body.id - Stack ID
   * @returns success message
   */
  const deleteStack = async (req, res) => {
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
          msg: "Stack ID is required",
        });
      }

      const stack = await Stack.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!stack) {
        return res.status(404).json({
          success: false,
          msg: "Stack not found",
        });
      }

      // Check if stack has notebooks
      const notebookCount = await Notebook.count({
        where: {
          stack_id: id,
        },
      });

      if (notebookCount > 0) {
        // Option 1: Set notebooks' stack_id to null (unstack them)
        await Notebook.update(
          { stack_id: null },
          {
            where: {
              stack_id: id,
            },
          }
        );

        // Option 2: Or return error if you want to prevent deletion
        // return res.status(400).json({
        //   success: false,
        //   msg: "Cannot delete stack with notebooks. Please move or delete notebooks first.",
        // });
      }

      // Delete the stack
      await stack.destroy();

      return res.status(200).json({
        success: true,
        msg: "Stack deleted successfully",
      });
    } catch (error) {
      console.error("Delete stack error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Reorder stacks (update sort_order for multiple stacks)
   * @param req.user - User from authentication middleware
   * @param req.body.stacks - Array of { id, sort_order } objects
   * @returns success message
   */
  const reorderStacks = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { stacks } = req.body;

      if (!stacks || !Array.isArray(stacks) || stacks.length === 0) {
        return res.status(400).json({
          success: false,
          msg: "Stacks array is required",
        });
      }

      // Validate all stacks belong to user and update sort_order
      const updatePromises = stacks.map(async ({ id, sort_order }) => {
        if (!id || sort_order === undefined) {
          throw new Error("Each stack must have id and sort_order");
        }

        const stack = await Stack.findOne({
          where: {
            id,
            user_id: req.user.id,
          },
        });

        if (!stack) {
          throw new Error(`Stack with id ${id} not found`);
        }

        return stack.update({ sort_order });
      });

      await Promise.all(updatePromises);

      return res.status(200).json({
        success: true,
        msg: "Stacks reordered successfully",
      });
    } catch (error) {
      console.error("Reorder stacks error:", error);
      return res.status(500).json({
        success: false,
        msg: error.message || "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get all notebooks in a stack
   * @param req.user - User from authentication middleware
   * @param req.body.id - Stack ID
   * @returns list of notebooks in the stack
   */
  const getStackNotebooks = async (req, res) => {
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
          msg: "Stack ID is required",
        });
      }

      // Verify stack belongs to user
      const stack = await Stack.findOne({
        where: {
          id,
          user_id: req.user.id,
        },
      });

      if (!stack) {
        return res.status(404).json({
          success: false,
          msg: "Stack not found",
        });
      }

      // Get notebooks in this stack
      const notebooks = await Notebook.findAll({
        where: {
          stack_id: id,
          user_id: req.user.id,
        },
        include: [
          {
            model: Color,
            as: "color",
            attributes: ["id", "name", "hex_code"],
          },
        ],
        order: [["sort_order", "ASC"], ["created_at", "DESC"]],
      });

      return res.status(200).json({
        success: true,
        data: {
          stack: {
            id: stack.id,
            name: stack.name,
            description: stack.description,
          },
          notebooks,
          count: notebooks.length,
        },
      });
    } catch (error) {
      console.error("Get stack notebooks error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  const getAllStackList = async (req, res) => {

    try {
      const stacks = await Stack.findAll({
        where: { user_id: req.user.id },
        attributes: ["id", "name"],
      });

      return res.status(200).json({
        success: true,
        stacks,
      });
    } catch (error) {
      console.error("Get all stack list error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  return {
    createStack,
    getAllStacks,
    getStackById,
    updateStack,
    deleteStack,
    reorderStacks,
    getStackNotebooks,
    getAllStackList
  };
};

module.exports = StackController();
