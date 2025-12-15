const Sequelize = require("sequelize");
const Task = require("../models/task");
const Note = require("../models/note");

const TaskController = () => {
  /**
   * @description Create a new task under a note
   * @param req.user - User from authentication middleware
   * @param req.body.note_id - Note ID (required)
   * @param req.body.label - Task label/description (required)
   * @param req.body.sort_order - Sort order (optional, defaults to 0)
   * @param req.body.completed - Completion status (optional, defaults to false)
   * @returns created task
   */
  const createTask = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { note_id, label, sort_order, completed } = req.body;

      if (!note_id || !label) {
        return res.status(400).json({
          success: false,
          msg: "Note ID and label are required",
        });
      }

      // Verify note belongs to user
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

      // Get max sort_order for this note if not provided
      let finalSortOrder = sort_order;
      if (sort_order === undefined || sort_order === null) {
        const maxTask = await Task.findOne({
          where: { note_id },
          order: [["sort_order", "DESC"]],
          attributes: ["sort_order"],
        });
        finalSortOrder = maxTask ? maxTask.sort_order + 1 : 0;
      }

      // Create task
      const task = await Task.create({
        note_id,
        label: label.trim(),
        sort_order: finalSortOrder,
        completed: completed === true || completed === "true",
      });

      return res.status(201).json({
        success: true,
        msg: "Task created successfully",
        data: {
          task,
        },
      });
    } catch (error) {
      console.error("Create task error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get a single task by ID
   * @param req.user - User from authentication middleware
   * @param req.body.id - Task ID
   * @returns task details
   */
  const getTaskById = async (req, res) => {
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
          msg: "Task ID is required",
        });
      }

      // Find task first
      const task = await Task.findOne({
        where: { id },
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          msg: "Task not found",
        });
      }

      // Verify note belongs to user
      const note = await Note.findOne({
        where: {
          id: task.note_id,
          user_id: req.user.id,
        },
      });

      if (!note) {
        return res.status(403).json({
          success: false,
          msg: "Access denied: Task does not belong to user",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          task,
        },
      });
    } catch (error) {
      console.error("Get task by ID error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Update task (label and/or sort_order)
   * @param req.user - User from authentication middleware
   * @param req.body.id - Task ID
   * @param req.body.label - New label (optional)
   * @param req.body.sort_order - New sort order (optional)
   * @returns updated task
   */
  const updateTask = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { id, label, sort_order } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          msg: "Task ID is required",
        });
      }

      // Find task first
      const task = await Task.findOne({
        where: { id },
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          msg: "Task not found",
        });
      }

      // Verify note belongs to user
      const note = await Note.findOne({
        where: {
          id: task.note_id,
          user_id: req.user.id,
        },
      });

      if (!note) {
        return res.status(403).json({
          success: false,
          msg: "Access denied: Task does not belong to user",
        });
      }

      // Update task fields
      if (label !== undefined) {
        task.label = label.trim();
      }
      if (sort_order !== undefined) {
        task.sort_order = sort_order;
      }

      await task.save();

      return res.status(200).json({
        success: true,
        msg: "Task updated successfully",
        data: {
          task,
        },
      });
    } catch (error) {
      console.error("Update task error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Toggle task completion status
   * @param req.user - User from authentication middleware
   * @param req.body.id - Task ID
   * @returns updated task
   */
  const toggleTaskComplete = async (req, res) => {
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
          msg: "Task ID is required",
        });
      }

      // Find task first
      const task = await Task.findOne({
        where: { id },
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          msg: "Task not found",
        });
      }

      // Verify note belongs to user
      const note = await Note.findOne({
        where: {
          id: task.note_id,
          user_id: req.user.id,
        },
      });

      if (!note) {
        return res.status(403).json({
          success: false,
          msg: "Access denied: Task does not belong to user",
        });
      }

      // Toggle completion status
      task.completed = !task.completed;
      await task.save();

      return res.status(200).json({
        success: true,
        msg: `Task ${task.completed ? "completed" : "uncompleted"} successfully`,
        data: {
          task,
        },
      });
    } catch (error) {
      console.error("Toggle task complete error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Delete a task
   * @param req.user - User from authentication middleware
   * @param req.body.id - Task ID
   * @returns success message
   */
  const deleteTask = async (req, res) => {
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
          msg: "Task ID is required",
        });
      }

      // Find task first
      const task = await Task.findOne({
        where: { id },
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          msg: "Task not found",
        });
      }

      // Verify note belongs to user
      const note = await Note.findOne({
        where: {
          id: task.note_id,
          user_id: req.user.id,
        },
      });

      if (!note) {
        return res.status(403).json({
          success: false,
          msg: "Access denied: Task does not belong to user",
        });
      }

      await task.destroy();

      return res.status(200).json({
        success: true,
        msg: "Task deleted successfully",
      });
    } catch (error) {
      console.error("Delete task error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Reorder tasks in bulk (update sort_order for multiple tasks)
   * @param req.user - User from authentication middleware
   * @param req.body.tasks - Array of {id, sort_order} objects
   * @returns success message
   */
  const reorderTasks = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { tasks } = req.body;

      if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        return res.status(400).json({
          success: false,
          msg: "Tasks array is required and must not be empty",
        });
      }

      // Verify all tasks belong to user's notes
      const taskIds = tasks.map((t) => t.id);
      const existingTasks = await Task.findAll({
        where: {
          id: {
            [Sequelize.Op.in]: taskIds,
          },
        },
      });

      if (existingTasks.length !== taskIds.length) {
        return res.status(404).json({
          success: false,
          msg: "One or more tasks not found",
        });
      }

      // Get unique note_ids from tasks
      const noteIds = [...new Set(existingTasks.map((t) => t.note_id))];

      // Verify all notes belong to user
      const userNotes = await Note.findAll({
        where: {
          id: {
            [Sequelize.Op.in]: noteIds,
          },
          user_id: req.user.id,
        },
        attributes: ["id"],
      });

      if (userNotes.length !== noteIds.length) {
        return res.status(403).json({
          success: false,
          msg: "One or more tasks do not belong to user",
        });
      }

      // Update sort_order for each task
      const updatePromises = tasks.map(({ id, sort_order }) => {
        return Task.update(
          { sort_order },
          {
            where: { id },
          }
        );
      });

      await Promise.all(updatePromises);

      return res.status(200).json({
        success: true,
        msg: "Tasks reordered successfully",
        data: {
          updated_count: tasks.length,
        },
      });
    } catch (error) {
      console.error("Reorder tasks error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get all tasks for a note
   * @param req.user - User from authentication middleware
   * @param req.body.noteId - Note ID
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

      // Get all tasks for this note
      const tasks = await Task.findAll({
        where: {
          note_id: noteId,
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
    createTask,
    getTaskById,
    updateTask,
    toggleTaskComplete,
    deleteTask,
    reorderTasks,
    getNoteTasks,
  };
};

module.exports = TaskController();

