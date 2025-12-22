const Sequelize = require("sequelize");
const Note = require("../models/note");
const Notebook = require("../models/notebook");
const Stack = require("../models/stack");
const Color = require("../models/color");
const User = require("../models/user");
const NoteTag = require("../models/noteTag");
const File = require("../models/file");
const Task = require("../models/task");
const { Op } = require("sequelize");

const calendarController = () => {
  /**
   * @description Get calendar events by date (supports day/week/month views)
   * @param req.user - User from authentication middleware
   * @param req.query.date - Date string (ISO format or YYYY-MM-DD)
   * @param req.query.view - View type: 'day', 'week', or 'month' (optional, defaults to 'day')
   * @returns calendar events (tasks and notes) for the specified date/view
   */
  const getCalendarEventsByDate = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { date, view = "day" } = req.query;

      if (!date) {
        return res.status(400).json({
          success: false,
          msg: "Date is required",
        });
      }

      const targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({
          success: false,
          msg: "Invalid date format",
        });
      }

      let startDate, endDate;

      switch (view.toLowerCase()) {
        case "day":
          // Single day
          startDate = new Date(targetDate);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(targetDate);
          endDate.setHours(23, 59, 59, 999);
          break;

        case "week":
          // Week view (Monday to Sunday)
          const dayOfWeek = targetDate.getDay();
          const diff = targetDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
          startDate = new Date(targetDate.setDate(diff));
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 6);
          endDate.setHours(23, 59, 59, 999);
          break;

        case "month":
          // Month view (first day to last day of month)
          startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
          endDate.setHours(23, 59, 59, 999);
          break;

        default:
          return res.status(400).json({
            success: false,
            msg: "Invalid view. Must be 'day', 'week', or 'month'",
          });
      }

      const items = [];

      // Fetch tasks with due_date in the date range
      const tasks = await Task.findAll({
        where: {
          due_date: {
            [Op.between]: [startDate, endDate],
          },
        },
        include: [
          {
            model: Note,
            as: "note",
            where: {
              user_id: req.user.id,
              trashed: false,
            },
            required: true,
            attributes: ["id", "title"],
          },
        ],
        attributes: ["id", "label", "due_date", "completed", "priority", "flagged"],
        order: [["due_date", "ASC"]],
      });

      // Map tasks to calendar items
      tasks.forEach((task) => {
        const taskData = task.toJSON();
        const isOverdue = taskData.due_date && new Date(taskData.due_date) < new Date() && !taskData.completed;
        
        // Calculate end time (1 hour after start, or null if allDay)
        const startTime = new Date(taskData.due_date);
        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + 1);

        items.push({
          id: `task_${taskData.id}`,
          type: "task",
          title: taskData.label,
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          allDay: false,
          completed: taskData.completed || false,
          color: taskData.completed
            ? "#9e9e9e" // grey if completed
            : isOverdue
            ? "#f44336" // red if overdue
            : taskData.priority === "high"
            ? "#ff5722" // orange-red for high priority
            : "#ffc107", // default yellow for tasks
          sourceId: taskData.id,
        });
      });

      // Fetch notes with created_at, updated_at, or last_modified in the date range
      const notes = await Note.findAll({
        where: {
          user_id: req.user.id,
          trashed: false,
          [Op.or]: [
            {
              created_at: {
                [Op.between]: [startDate, endDate],
              },
            },
            {
              updated_at: {
                [Op.between]: [startDate, endDate],
              },
            },
            {
              last_modified: {
                [Op.between]: [startDate, endDate],
              },
            },
          ],
        },
        attributes: ["id", "title", "created_at", "updated_at"],
        order: [["created_at", "DESC"]],
      });

      // Map notes to calendar items
      notes.forEach((note) => {
        const noteData = note.toJSON();
        const displayDate = noteData.updated_at || noteData.created_at;

        items.push({
          id: `note_${noteData.id}`,
          type: "note",
          title: noteData.title || "Untitled Note",
          start: displayDate ? new Date(displayDate).toISOString() : null,
          end: null,
          allDay: true,
          completed: false,
          color: "#00ff00", // green for notes
          sourceId: noteData.id,
        });
      });

      return res.status(200).json({
        success: true,
        data: {
          items,
        },
      });
    } catch (error) {
      console.error("Get calendar events by date error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get a specific calendar event by ID (task ID primary key)
   * @param req.user - User from authentication middleware
   * @param req.params.id - Task ID (primary key)
   * @returns calendar event (task) details
   */
  const getCalendarEventById = async (req, res) => {
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
          msg: "Event ID is required",
        });
      }

      // Get task with note relationship
      const task = await Task.findOne({
        where: { id },
        include: [
          {
            model: Note,
            as: "note",
            where: {
              user_id: req.user.id,
              trashed: false,
            },
            required: true,
            attributes: ["id", "title"],
          },
        ],
        attributes: ["id", "label", "due_date", "completed", "priority", "flagged"],
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          msg: "Calendar event not found",
        });
      }

      const taskData = task.toJSON();
      const isOverdue = taskData.due_date && new Date(taskData.due_date) < new Date() && !taskData.completed;
      
      // Calculate end time (1 hour after start, or null if allDay)
      const startTime = new Date(taskData.due_date);
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + 1);

      const item = {
        id: `task_${taskData.id}`,
        type: "task",
        title: taskData.label,
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        allDay: false,
        completed: taskData.completed || false,
        color: taskData.completed
          ? "#9e9e9e" // grey if completed
          : isOverdue
          ? "#f44336" // red if overdue
          : taskData.priority === "high"
          ? "#ff5722" // orange-red for high priority
          : "#ffc107", // default yellow for tasks
        sourceId: taskData.id,
      };

      return res.status(200).json({
        success: true,
        data: {
          item,
        },
      });
    } catch (error) {
      console.error("Get calendar event by ID error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get calendar events within a date range
   * @param req.user - User from authentication middleware
   * @param req.query.startDate - Start date string (ISO format or YYYY-MM-DD)
   * @param req.query.endDate - End date string (ISO format or YYYY-MM-DD)
   * @returns calendar events (tasks and notes) within the date range
   */
  const getCalendarEventsByRange = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { startDate: start, endDate: end } = req.query;

      if (!start || !end) {
        return res.status(400).json({
          success: false,
          msg: "Start date and end date are required",
        });
      }

      const startDate = new Date(start);
      const endDate = new Date(end);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          msg: "Invalid date format",
        });
      }

      if (startDate > endDate) {
        return res.status(400).json({
          success: false,
          msg: "Start date must be before or equal to end date",
        });
      }

      // Set time boundaries
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      const items = [];

      // Fetch tasks with due_date in the date range
      const tasks = await Task.findAll({
        where: {
          due_date: {
            [Op.between]: [startDate, endDate],
          },
        },
        include: [
          {
            model: Note,
            as: "note",
            where: {
              user_id: req.user.id,
              trashed: false,
            },
            required: true,
            attributes: ["id", "title"],
          },
        ],
        attributes: ["id", "label", "due_date", "completed", "priority", "flagged"],
        order: [["due_date", "ASC"]],
      });

      // Map tasks to calendar items
      tasks.forEach((task) => {
        const taskData = task.toJSON();
        const isOverdue = taskData.due_date && new Date(taskData.due_date) < new Date() && !taskData.completed;
        
        // Calculate end time (1 hour after start, or null if allDay)
        const startTime = new Date(taskData.due_date);
        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + 1);

        items.push({
          id: `task_${taskData.id}`,
          type: "task",
          title: taskData.label,
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          allDay: false,
          completed: taskData.completed || false,
          color: taskData.completed
            ? "#9e9e9e" // grey if completed
            : isOverdue
            ? "#f44336" // red if overdue
            : taskData.priority === "high"
            ? "#ff5722" // orange-red for high priority
            : "#ffc107", // default yellow for tasks
          sourceId: taskData.id,
        });
      });

      // Fetch notes with created_at, updated_at, or last_modified in the date range
      const notes = await Note.findAll({
        where: {
          user_id: req.user.id,
          trashed: false,
          [Op.or]: [
            {
              created_at: {
                [Op.between]: [startDate, endDate],
              },
            },
            {
              updated_at: {
                [Op.between]: [startDate, endDate],
              },
            },
            {
              last_modified: {
                [Op.between]: [startDate, endDate],
              },
            },
          ],
        },
        attributes: ["id", "title", "created_at", "updated_at"],
        order: [["created_at", "ASC"]],
      });

      // Map notes to calendar items
      notes.forEach((note) => {
        const noteData = note.toJSON();
        const displayDate = noteData.updated_at || noteData.created_at;

        items.push({
          id: `note_${noteData.id}`,
          type: "note",
          title: noteData.title || "Untitled Note",
          start: displayDate ? new Date(displayDate).toISOString() : null,
          end: null,
          allDay: true,
          completed: false,
          color: "#00ff00", // green for notes
          sourceId: noteData.id,
        });
      });

      return res.status(200).json({
        success: true,
        data: {
          items,
        },
      });
    } catch (error) {
      console.error("Get calendar events by range error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get all calendar items (tasks with due_date and notes)
   * @param req.user - User from authentication middleware
   * @returns all calendar items (tasks and notes)
   */
  const getCalendarItems = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const userId = req.user.id;

      // Fetch tasks that have a due_date
      const tasks = await Task.findAll({
        attributes: ["id", "label", "due_date", "completed", "priority", "flagged"],
        where: {
          due_date: { [Op.ne]: null }, // only tasks with due date
        },
        include: [
          {
            model: Note,
            as: "note",
            where: { user_id: userId },
            attributes: ["id", "title"],
            required: true,
          },
        ],
        order: [["due_date", "ASC"]],
      });

      // Fetch notes (all non-trashed notes)
      const notes = await Note.findAll({
        where: {
          user_id: userId,
          trashed: false,
        },
        attributes: ["id", "title", "created_at", "updated_at"],
        order: [["updated_at", "DESC"]],
      });

      // Map to unified calendar format
      const items = [];

      // Map tasks
      tasks.forEach((task) => {
        const taskData = task.toJSON();
        const isOverdue = taskData.due_date && new Date(taskData.due_date) < new Date() && !taskData.completed;

        // Calculate end time (1 hour after start)
        const startTime = new Date(taskData.due_date);
        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + 1);

        items.push({
          id: `task_${taskData.id}`,
          type: "task",
          title: taskData.label,
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          allDay: false,
          completed: taskData.completed || false,
          color: taskData.completed
            ? "#9e9e9e" // grey if completed
            : isOverdue
            ? "#f44336" // red if overdue
            : taskData.priority === "high"
            ? "#ff5722" // orange-red for high priority
            : "#ffc107", // default yellow for tasks
          sourceId: taskData.id,
        });
      });

      // Map notes
      notes.forEach((note) => {
        const noteData = note.toJSON();
        const displayDate = noteData.updated_at || noteData.created_at;

        items.push({
          id: `note_${noteData.id}`,
          type: "note",
          title: noteData.title || "Untitled Note",
          start: displayDate ? new Date(displayDate).toISOString() : null,
          end: null,
          allDay: true,
          completed: false,
          color: "#00ff00", // green for notes
          sourceId: noteData.id,
        });
      });

      return res.status(200).json({
        success: true,
        data: {
          items,
        },
      });
    } catch (error) {
      console.error("Get calendar items error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Update a calendar event (task) start/end dates
   * @param req.user - User from authentication middleware
   * @param req.params.id - Task ID (primary key)
   * @param req.body.start - Start date/time (ISO format)
   * @param req.body.end - End date/time (ISO format, optional)
   * @param req.body.allDay - Whether event is all-day (optional)
   * @returns updated calendar event
   */
  const updateCalendarEvent = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { id } = req.params;
      const { start, end, allDay } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          msg: "Event ID is required",
        });
      }

      if (!start) {
        return res.status(400).json({
          success: false,
          msg: "Start date is required",
        });
      }

      // Get task and verify it belongs to user's note
      const task = await Task.findOne({
        where: { id },
        include: [
          {
            model: Note,
            as: "note",
            where: {
              user_id: req.user.id,
              trashed: false,
            },
            required: true,
            attributes: ["id", "title"],
          },
        ],
        attributes: ["id", "label", "due_date", "completed", "priority", "flagged"],
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          msg: "Calendar event not found",
        });
      }

      // Update task due_date from start
      const startDate = new Date(start);
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({
          success: false,
          msg: "Invalid start date format",
        });
      }

      await Task.update(
        {
          due_date: startDate,
        },
        {
          where: { id },
        }
      );

      // Fetch updated task
      const updatedTask = await Task.findOne({
        where: { id },
        include: [
          {
            model: Note,
            as: "note",
            required: true,
            attributes: ["id", "title"],
          },
        ],
        attributes: ["id", "label", "due_date", "completed", "priority", "flagged"],
      });

      const taskData = updatedTask.toJSON();
      const isOverdue = taskData.due_date && new Date(taskData.due_date) < new Date() && !taskData.completed;

      // Calculate end time
      let endTime;
      if (end) {
        endTime = new Date(end);
      } else {
        endTime = new Date(startDate);
        endTime.setHours(endTime.getHours() + 1);
      }

      const item = {
        id: `task_${taskData.id}`,
        type: "task",
        title: taskData.label,
        start: startDate.toISOString(),
        end: endTime.toISOString(),
        allDay: allDay === true || allDay === "true" || false,
        completed: taskData.completed || false,
        color: taskData.completed
          ? "#9e9e9e" // grey if completed
          : isOverdue
          ? "#f44336" // red if overdue
          : taskData.priority === "high"
          ? "#ff5722" // orange-red for high priority
          : "#ffc107", // default yellow for tasks
        sourceId: taskData.id,
      };

      return res.status(200).json({
        success: true,
        data: {
          item,
        },
      });
    } catch (error) {
      console.error("Update calendar event error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  return {
    getCalendarEventsByDate,
    getCalendarEventById,
    getCalendarEventsByRange,
    getCalendarItems,
    updateCalendarEvent,
  };
};


module.exports = calendarController;
