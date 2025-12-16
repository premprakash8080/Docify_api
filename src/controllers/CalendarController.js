const Sequelize = require("sequelize");
const Note = require("../models/note");
const Notebook = require("../models/notebook");
const Stack = require("../models/stack");
const Color = require("../models/color");
const User = require("../models/user");
const NoteTag = require("../models/noteTag");
const File = require("../models/file");
const Task = require("../models/task");

const CalendarController = () => {
  /**
   * @description Get calendar events by date (supports day/week/month views)
   * @param req.user - User from authentication middleware
   * @param req.body.date - Date string (ISO format or YYYY-MM-DD)
   * @param req.body.view - View type: 'day', 'week', or 'month' (optional, defaults to 'day')
   * @returns calendar events (notes) for the specified date/view
   */
  const getCalendarEventsByDate = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { date, view = "day" } = req.body;

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

      // Get notes with relationships where created_at, updated_at, or last_modified falls within the date range
      // Exclude trashed notes
      const notes = await Note.findAll({
        where: {
          user_id: req.user.id,
          trashed: false,
          [Sequelize.Op.or]: [
            {
              created_at: {
                [Sequelize.Op.between]: [startDate, endDate],
              },
            },
            {
              updated_at: {
                [Sequelize.Op.between]: [startDate, endDate],
              },
            },
            {
              last_modified: {
                [Sequelize.Op.between]: [startDate, endDate],
              },
            },
          ],
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
        order: [["created_at", "DESC"]],
      });

      // Build events with aggregated counts
      const events = await Promise.all(
        notes.map(async (note) => {
          const noteData = note.toJSON();

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
            type: "note",
          };
        })
      );

      return res.status(200).json({
        success: true,
        data: {
          date: date,
          view: view,
          startDate: startDate,
          endDate: endDate,
          events,
          count: events.length,
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
   * @description Get a specific calendar event by ID
   * @param req.user - User from authentication middleware
   * @param req.body.id - Note ID
   * @returns calendar event (note) details
   */
  const getCalendarEventById = async (req, res) => {
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
          msg: "Event ID is required",
        });
      }

      // Get note with relationships and aggregated counts
      const note = await Note.findOne({
        where: {
          id,
          user_id: req.user.id,
          trashed: false,
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

      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Calendar event not found",
        });
      }

      const noteData = note.toJSON();

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

      const event = {
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
        type: "note",
      };

      return res.status(200).json({
        success: true,
        data: {
          event,
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
   * @param req.body.start - Start date string (ISO format or YYYY-MM-DD)
   * @param req.body.end - End date string (ISO format or YYYY-MM-DD)
   * @returns calendar events (notes) within the date range
   */
  const getCalendarEventsByRange = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { start, end } = req.body;

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

      // Get notes with relationships where created_at, updated_at, or last_modified falls within the date range
      // Exclude trashed notes
      const notes = await Note.findAll({
        where: {
          user_id: req.user.id,
          trashed: false,
          [Sequelize.Op.or]: [
            {
              created_at: {
                [Sequelize.Op.between]: [startDate, endDate],
              },
            },
            {
              updated_at: {
                [Sequelize.Op.between]: [startDate, endDate],
              },
            },
            {
              last_modified: {
                [Sequelize.Op.between]: [startDate, endDate],
              },
            },
          ],
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
        order: [["created_at", "ASC"]],
      });

      // Build events with aggregated counts
      const events = await Promise.all(
        notes.map(async (note) => {
          const noteData = note.toJSON();

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
            type: "note",
          };
        })
      );

      return res.status(200).json({
        success: true,
        data: {
          startDate: startDate,
          endDate: endDate,
          events,
          count: events.length,
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

  return {
    getCalendarEventsByDate,
    getCalendarEventById,
    getCalendarEventsByRange,
  };
};

module.exports = CalendarController();

