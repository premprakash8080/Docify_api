const Sequelize = require("sequelize");
const Note = require("../models/note");

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

      // Get notes where created_at, updated_at, or last_modified falls within the date range
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
        order: [["created_at", "DESC"]],
      });

      // Format notes as calendar events
      const events = notes.map((note) => ({
        id: note.id,
        title: note.title,
        date: note.created_at,
        created_at: note.created_at,
        updated_at: note.updated_at,
        last_modified: note.last_modified,
        notebook_id: note.notebook_id,
        pinned: note.pinned,
        archived: note.archived,
        type: "note", // Calendar event type
      }));

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

      const note = await Note.findOne({
        where: {
          id,
          user_id: req.user.id,
          trashed: false,
        },
      });

      if (!note) {
        return res.status(404).json({
          success: false,
          msg: "Calendar event not found",
        });
      }

      // Format note as calendar event
      const event = {
        id: note.id,
        title: note.title,
        date: note.created_at,
        created_at: note.created_at,
        updated_at: note.updated_at,
        last_modified: note.last_modified,
        notebook_id: note.notebook_id,
        pinned: note.pinned,
        archived: note.archived,
        version: note.version,
        synced: note.synced,
        firebase_document_id: note.firebase_document_id,
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

      // Get notes where created_at, updated_at, or last_modified falls within the date range
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
        order: [["created_at", "ASC"]],
      });

      // Format notes as calendar events
      const events = notes.map((note) => ({
        id: note.id,
        title: note.title,
        date: note.created_at,
        created_at: note.created_at,
        updated_at: note.updated_at,
        last_modified: note.last_modified,
        notebook_id: note.notebook_id,
        pinned: note.pinned,
        archived: note.archived,
        type: "note",
      }));

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

