const Sequelize = require("sequelize");
const Task = require("../models/task");
const Note = require("../models/note");
const { Op } = require("sequelize");

const TaskController = () => {
  /**
   * Helper function to check for time-slot conflicts
   * @param {number} userId - User ID
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} startTime - Start time (HH:MM:SS or HH:MM)
   * @param {string} endTime - End time (HH:MM:SS or HH:MM)
   * @param {number} excludeTaskId - Task ID to exclude from conflict check (for updates)
   * @returns {Promise<boolean>} - Returns true if conflict exists
   */
  const checkTimeSlotConflict = async (userId, startDate, startTime, endTime, excludeTaskId = null) => {
    if (!startDate || !startTime || !endTime) {
      return false; // No conflict if time information is incomplete
    }

    // Get all user's notes
    const userNotes = await Note.findAll({
      where: {
        user_id: userId,
      },
      attributes: ["id"],
    });

    const noteIds = userNotes.map(note => note.id);

    // Build where clause to find tasks on the same date
    // Tasks must belong to user's notes (we don't check standalone tasks with note_id=null for ownership)
    const whereConditions = [];
    
    if (noteIds.length > 0) {
      whereConditions.push({ note_id: { [Op.in]: noteIds } });
    }

    // If no notes, return false (no tasks to check)
    if (whereConditions.length === 0) {
      return false;
    }

    const whereClause = {
      start_date: startDate,
      start_time: { [Op.ne]: null },
      end_time: { [Op.ne]: null },
      [Op.or]: whereConditions,
    };

    // Exclude the current task if updating
    if (excludeTaskId) {
      whereClause.id = { [Op.ne]: excludeTaskId };
    }

    // Get all tasks on the same date with time slots
    const existingTasks = await Task.findAll({
      where: whereClause,
      attributes: ["id", "start_time", "end_time"],
    });

    // Convert times to minutes for easier comparison
    const timeToMinutes = (timeStr) => {
      if (!timeStr) return null;
      const time = typeof timeStr === 'string' ? timeStr : timeStr.toString();
      const parts = time.split(':');
      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1] || 0);
      return hours * 60 + minutes;
    };

    const newStartMinutes = timeToMinutes(startTime);
    const newEndMinutes = timeToMinutes(endTime);

    if (newStartMinutes === null || newEndMinutes === null) {
      return false;
    }

    // Validate that start time is before end time
    if (newStartMinutes >= newEndMinutes) {
      return false; // Invalid time range, but don't treat as conflict
    }

    // Check for overlaps
    // Two time slots overlap if: start1 < end2 AND start2 < end1
    for (const task of existingTasks) {
      const existingStartMinutes = timeToMinutes(task.start_time);
      const existingEndMinutes = timeToMinutes(task.end_time);

      if (existingStartMinutes === null || existingEndMinutes === null) {
        continue;
      }

      // Check if time slots overlap
      if (newStartMinutes < existingEndMinutes && existingStartMinutes < newEndMinutes) {
        return true; // Conflict found
      }
    }

    return false; // No conflict
  };
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

      const {
        note_id = null,
        label,
        description,
        due_date,
        start_time,
        end_time,
        reminder,
        assigned_to,
        priority,
        flagged,
        sort_order,
        completed
      } = req.body;

      if (!due_date || !label || !end_time || !start_time) {
        return res.status(400).json({
          success: false,
          msg: "Required fields are missing",
        });
      }

      // Verify note belongs to user
      if (note_id) {
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
      }

      // Check for time-slot conflicts
      const hasConflict = await checkTimeSlotConflict(
        req.user.id,
        due_date,
        start_time,
        end_time
      );

      if (hasConflict) {
        return res.status(200).json({
          success: false,
          msg: "This time slot is already occupied",
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
        note_id: note_id || null,
        label: label.trim(),
        description: description ? description.trim() : null,
        start_date: due_date || null,
        start_time: start_time || null,
        end_time: end_time || null,
        reminder: reminder || null,
        assigned_to: assigned_to ? assigned_to.trim() : null,
        priority: priority || null,
        flagged: flagged === true || flagged === "true",
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
   * @param req.query.id - Task ID (from query)
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

      const { id } = req.query;

      if (!id) {
        return res.status(400).json({
          success: false,
          msg: "Task ID is required",
        });
      }

      // Find task first
      const task = await Task.findOne({
        where: { id },
        attributes: ["id", "note_id", "label", "description", "start_date", "start_time", "end_time", "reminder", "assigned_to", "priority", "flagged", "sort_order", "completed"],
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          msg: "Task not found",
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
   * @description Update task (label, description, start_date, start_time, end_time, reminder, assigned_to, priority, flagged, sort_order)
   * @param req.user - User from authentication middleware
   * @param req.body.id - Task ID (from body)
   * @param req.body.label - New label (optional)
   * @param req.body.description - New description (optional)
   * @param req.body.start_date - New start date (optional)
   * @param req.body.start_time - New start time (optional)
   * @param req.body.end_time - New end time (optional)
   * @param req.body.reminder - New reminder (optional)
   * @param req.body.assigned_to - New assignee (optional)
   * @param req.body.priority - New priority (optional)
   * @param req.body.flagged - New flagged status (optional)
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

      const {
        id,
        label,
        description,
        due_date, // Map to start_date for backward compatibility
        start_date,
        start_time,
        end_time,
        reminder,
        assigned_to,
        priority,
        flagged,
        sort_order
      } = req.body;

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

      // Verify task belongs to user
      // If task has a note_id, verify the note belongs to user
      // If task has no note_id (standalone), we need to check ownership differently
      // For now, if note_id is null, we'll allow the update (you may want to add user_id to tasks later)
      if (task.note_id) {
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
      }

      // Determine the final values for date and times (use new values if provided, otherwise keep existing)
      const finalStartDate = due_date || start_date || task.start_date;
      const finalStartTime = start_time !== undefined ? start_time : task.start_time;
      const finalEndTime = end_time !== undefined ? end_time : task.end_time;

      // Check for time-slot conflicts only if date and times are being set/changed
      if (finalStartDate && finalStartTime && finalEndTime) {
        const hasConflict = await checkTimeSlotConflict(
          req.user.id,
          finalStartDate,
          finalStartTime,
          finalEndTime,
          task.id // Exclude current task from conflict check
        );

        if (hasConflict) {
          return res.status(200).json({
            success: false,
            msg: "This time slot is already occupied",
          });
        }
      }

      // Update task fields
      if (label !== undefined) {
        task.label = label.trim();
      }
      if (description !== undefined) {
        task.description = description ? description.trim() : null;
      }
      // Handle due_date for backward compatibility (map to start_date)
      if (due_date !== undefined) {
        task.start_date = due_date || null;
      } else if (start_date !== undefined) {
        task.start_date = start_date || null;
      }
      if (start_time !== undefined) {
        task.start_time = start_time || null;
      }
      if (end_time !== undefined) {
        task.end_time = end_time || null;
      }
      if (reminder !== undefined) {
        task.reminder = reminder || null;
      }
      if (assigned_to !== undefined) {
        task.assigned_to = assigned_to ? assigned_to.trim() : null;
      }
      if (priority !== undefined) {
        task.priority = priority || null;
      }
      if (flagged !== undefined) {
        task.flagged = flagged === true || flagged === "true";
      }
      if (sort_order !== undefined) {
        task.sort_order = sort_order;
      }

      await task.save();

      // Format response with backward compatibility fields
      const taskData = task.toJSON();
      const formattedTask = {
        ...taskData,
        end_date: null, // For backward compatibility
        due_date: taskData.start_date, // Map start_date to due_date for backward compatibility
      };

      return res.status(200).json({
        success: true,
        msg: "Task updated successfully",
        data: {
          task: formattedTask,
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
   * @param req.body.id - Task ID (from body)
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
   * @param req.body.id - Task ID (from body)
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
   * @param req.query.noteId - Note ID (from query)
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

      const { noteId } = req.query;

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

  /**
   * @description Get all tasks for the current user with filtering and sorting
   * @param req.user - User from authentication middleware
   * @param req.query.q - Search query (searches in label and description)
   * @param req.query.label - Filter by task label
   * @param req.query.assigned_to - Filter by assigned_to
   * @param req.query.note_id - Filter by note_id
   * @param req.query.note_label - Filter by note title/label
   * @param req.query.priority - Filter by priority (low, medium, high)
   * @param req.query.status - Filter by completion status (completed, incomplete)
   * @param req.query.due_date - Filter by due_date (maps to start_date)
   * @param req.query.sort_by - Sort field (label, start_date, due_date, created_at, updated_at, sort_order)
   * @param req.query.sort_order - Sort order (asc, desc)
   * @returns list of tasks
   */
  const getAllTasks = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      // Extract query parameters
      const {
        q,
        label,
        assigned_to,
        note_id,
        note_label,
        priority,
        status,
        due_date,
        sort_by = "sort_order",
        sort_order = "asc",
      } = req.query;

      // Get all tasks for the current user
      // Tasks can belong to user's notes OR be standalone (note_id is null)
      // First get all user's notes
      const userNotes = await Note.findAll({
        where: {
          user_id: req.user.id,
        },
        attributes: ["id"],
      });

      const noteIds = userNotes.map(note => note.id);

      // Build base where clause to get tasks from user's notes OR tasks with null note_id
      const baseConditions = [];
      
      // If note_id filter is specified, use it directly (but still verify user ownership)
      if (note_id) {
        // Verify the note belongs to user
        const userNote = await Note.findOne({
          where: {
            id: note_id,
            user_id: req.user.id,
          },
        });
        if (userNote) {
          baseConditions.push({ note_id: note_id });
        } else {
          // Note doesn't belong to user, return empty result
          return res.status(200).json({
            success: true,
            data: {
              tasks: [],
              count: 0,
            },
          });
        }
      } else {
        // Tasks belonging to user's notes
        if (noteIds.length > 0) {
          baseConditions.push({ note_id: { [Sequelize.Op.in]: noteIds } });
        }
        // Standalone tasks (note_id is null)
        baseConditions.push({ note_id: null });
      }

      // Build additional filters
      const additionalFilters = [];

      // Apply search query filter (q)
      if (q && q.trim()) {
        additionalFilters.push({
          [Sequelize.Op.or]: [
            { label: { [Sequelize.Op.like]: `%${q.trim()}%` } },
            { description: { [Sequelize.Op.like]: `%${q.trim()}%` } },
          ],
        });
      }

      // Apply label filter (task label)
      if (label) {
        additionalFilters.push({
          label: { [Sequelize.Op.like]: `%${label.trim()}%` },
        });
      }

      // Apply assigned_to filter
      if (assigned_to) {
        additionalFilters.push({
          assigned_to: { [Sequelize.Op.like]: `%${assigned_to.trim()}%` },
        });
      }

      // Apply priority filter
      if (priority) {
        additionalFilters.push({ priority: priority.toLowerCase() });
      }

      // Apply status filter (completed/incomplete)
      if (status) {
        if (status.toLowerCase() === "completed") {
          additionalFilters.push({ completed: true });
        } else if (status.toLowerCase() === "incomplete") {
          additionalFilters.push({ completed: false });
        }
      }

      // Apply due_date filter (maps to start_date)
      if (due_date) {
        additionalFilters.push({ start_date: due_date });
      }

      // Build include clause for Note (needed for note_label filter and sorting)
      const includeClause = [];
      
      // When filtering by note_label, only include tasks that have a note
      if (note_label) {
        // Remove null note_id condition when filtering by note_label
        const filteredBaseConditions = baseConditions.filter(cond => {
          return !(cond.note_id === null);
        });
        
        // If we have valid base conditions (tasks with notes), add the Note include
        if (filteredBaseConditions.length > 0 || (noteIds.length > 0 && !note_id)) {
          includeClause.push({
            model: Note,
            as: "note",
            where: {
              user_id: req.user.id,
              title: { [Sequelize.Op.like]: `%${note_label.trim()}%` },
            },
            required: true, // INNER JOIN - only tasks with matching notes
            attributes: ["id", "title"],
          });
          
          // Update baseConditions to exclude null note_id when filtering by note_label
          baseConditions.length = 0;
          if (noteIds.length > 0) {
            baseConditions.push({ note_id: { [Sequelize.Op.in]: noteIds } });
          }
        } else {
          // No valid notes, return empty result
          return res.status(200).json({
            success: true,
            data: {
              tasks: [],
              count: 0,
            },
          });
        }
      } else if (sort_by.toLowerCase() === "note_label") {
        // When sorting by note_label, include Note but don't require it (LEFT JOIN)
        includeClause.push({
          model: Note,
          as: "note",
          where: { user_id: req.user.id },
          required: false, // LEFT JOIN - include tasks even without notes
          attributes: ["id", "title"],
        });
      }

      // Combine all conditions (after potential baseConditions modification)
      const whereClause = additionalFilters.length > 0
        ? {
            [Sequelize.Op.and]: [
              { [Sequelize.Op.or]: baseConditions },
              ...additionalFilters,
            ],
          }
        : {
            [Sequelize.Op.or]: baseConditions,
          };

      // Build order clause
      const orderBy = [];
      const validSortFields = ["label", "start_date", "due_date", "created_at", "updated_at", "sort_order", "note_label"];
      const sortField = validSortFields.includes(sort_by.toLowerCase()) 
        ? sort_by.toLowerCase() 
        : "sort_order";
      const sortDirection = sort_order.toLowerCase() === "desc" ? "DESC" : "ASC";
      
      // Map due_date to start_date for backward compatibility
      let actualSortField = sortField === "due_date" ? "start_date" : sortField;
      
      // Handle note_label sorting (requires join)
      if (actualSortField === "note_label") {
        // If sorting by note_label, we need to include Note
        if (includeClause.length === 0) {
          includeClause.push({
            model: Note,
            as: "note",
            where: { user_id: req.user.id },
            required: false,
            attributes: ["id", "title"],
          });
        }
        orderBy.push([{ model: Note, as: "note" }, "title", sortDirection]);
      } else {
        orderBy.push([actualSortField, sortDirection]);
      }

      // Get all tasks matching the criteria
      const tasks = await Task.findAll({
        where: whereClause,
        include: includeClause.length > 0 ? includeClause : undefined,
        order: orderBy,
      });

      // Format tasks for response (add null fields for backward compatibility)
      const formattedTasks = tasks.map(task => {
        const taskData = task.toJSON();
        return {
          ...taskData,
          end_date: null, // For backward compatibility
          due_date: taskData.start_date || null, // Map start_date to due_date for backward compatibility
        };
      });

      return res.status(200).json({
        success: true,
        data: {
          tasks: formattedTasks,
          count: formattedTasks.length,
        },
      });
    } catch (error) {
      console.error("Get all tasks error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get task details for calendar view
   * @param req.user - User from authentication middleware
   * @param req.query.id - Task ID
   * @returns task details
   */
  const getCalendarTaskDetails = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { id } = req.query;

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
      console.error("Get calendar task details error:", error);
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
    getAllTasks,
    getCalendarTaskDetails,
  };
};

module.exports = TaskController();

