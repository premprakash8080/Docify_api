const { Op, fn, col } = require("sequelize");
const StudySession = require("../models/studySession");
const Note = require("../models/note");
const MindMap = require("../models/mindmap");

const MIN_DURATION_SECONDS = 10;
const VALID_TYPES = ["note", "mind_map", "general"];

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const startOfWeek = (date = new Date()) => {
  const d = startOfDay(date);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  return d;
};

const startOfMonth = (date = new Date()) => {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
};

const sumDuration = async (where) => {
  const result = await StudySession.findOne({
    where,
    attributes: [[fn("COALESCE", fn("SUM", col("duration_seconds")), 0), "total"]],
    raw: true,
  });
  return Number(result && result.total ? result.total : 0);
};

const StudySessionController = () => {
  /**
   * @description Save a completed study session
   */
  const createSession = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, msg: "User not authenticated" });
      }

      let {
        note_id = null,
        mind_map_id = null,
        title = null,
        start_time,
        end_time,
        duration_seconds,
        session_type,
      } = req.body;

      if (!start_time || !end_time) {
        return res.status(400).json({
          success: false,
          msg: "start_time and end_time are required",
        });
      }

      const start = new Date(start_time);
      const end = new Date(end_time);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          msg: "Invalid start_time or end_time",
        });
      }

      // Compute duration if not supplied; otherwise trust the larger of the two
      // (covers paused timers where wall-clock end - start would over-count).
      const computedDuration = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
      const finalDuration = Number.isFinite(Number(duration_seconds))
        ? Math.max(0, Math.floor(Number(duration_seconds)))
        : computedDuration;

      if (finalDuration < MIN_DURATION_SECONDS) {
        return res.status(400).json({
          success: false,
          msg: `Session too short (minimum ${MIN_DURATION_SECONDS} seconds)`,
        });
      }

      // Resolve session_type and validate referenced records belong to user
      if (note_id) {
        const note = await Note.findOne({ where: { id: note_id, user_id: req.user.id } });
        if (!note) {
          return res.status(404).json({ success: false, msg: "Note not found" });
        }
        session_type = "note";
        if (!title) title = note.title;
        mind_map_id = null;
      } else if (mind_map_id) {
        const mindMap = await MindMap.findOne({ where: { id: mind_map_id, user_id: req.user.id } });
        if (!mindMap) {
          return res.status(404).json({ success: false, msg: "Mind map not found" });
        }
        session_type = "mind_map";
        if (!title) title = mindMap.title;
        note_id = null;
      } else {
        session_type = "general";
      }

      if (!VALID_TYPES.includes(session_type)) {
        session_type = "general";
      }

      const session = await StudySession.create({
        user_id: req.user.id,
        note_id,
        mind_map_id,
        title: title ? String(title).slice(0, 500) : null,
        start_time: start,
        end_time: end,
        duration_seconds: finalDuration,
        session_type,
      });

      return res.status(201).json({
        success: true,
        msg: "Study session saved",
        data: { session },
      });
    } catch (error) {
      console.error("Create study session error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Today's total studied time (in seconds)
   */
  const getToday = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, msg: "User not authenticated" });
      }
      const total = await sumDuration({
        user_id: req.user.id,
        start_time: { [Op.between]: [startOfDay(), endOfDay()] },
      });
      return res.status(200).json({
        success: true,
        data: { total_seconds: total },
      });
    } catch (error) {
      console.error("Get today study error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Weekly total studied time (in seconds, since Sunday)
   */
  const getWeek = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, msg: "User not authenticated" });
      }
      const total = await sumDuration({
        user_id: req.user.id,
        start_time: { [Op.between]: [startOfWeek(), endOfDay()] },
      });
      return res.status(200).json({
        success: true,
        data: { total_seconds: total },
      });
    } catch (error) {
      console.error("Get week study error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Aggregate stats: total / today / week / month / count / avg
   */
  const getStats = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, msg: "User not authenticated" });
      }
      const baseWhere = { user_id: req.user.id };

      const [totalSeconds, todaySeconds, weekSeconds, monthSeconds, countRow] = await Promise.all([
        sumDuration(baseWhere),
        sumDuration({ ...baseWhere, start_time: { [Op.between]: [startOfDay(), endOfDay()] } }),
        sumDuration({ ...baseWhere, start_time: { [Op.between]: [startOfWeek(), endOfDay()] } }),
        sumDuration({ ...baseWhere, start_time: { [Op.between]: [startOfMonth(), endOfDay()] } }),
        StudySession.findOne({
          where: baseWhere,
          attributes: [[fn("COUNT", col("id")), "count"]],
          raw: true,
        }),
      ]);

      const sessionCount = Number(countRow && countRow.count ? countRow.count : 0);
      const averageDuration = sessionCount > 0 ? Math.round(totalSeconds / sessionCount) : 0;

      return res.status(200).json({
        success: true,
        data: {
          total_seconds: totalSeconds,
          today_seconds: todaySeconds,
          week_seconds: weekSeconds,
          month_seconds: monthSeconds,
          session_count: sessionCount,
          average_session_seconds: averageDuration,
        },
      });
    } catch (error) {
      console.error("Get study stats error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Daily study time for the last N days (default 14, max 90).
   * Returns one entry per day in chronological order, including zero-totals
   * for days with no sessions so the chart x-axis is dense.
   */
  const getTimeline = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, msg: "User not authenticated" });
      }

      const requestedDays = parseInt(req.query.days, 10);
      const days = Math.min(90, Math.max(1, Number.isFinite(requestedDays) ? requestedDays : 14));

      const end = endOfDay();
      const start = startOfDay();
      start.setDate(start.getDate() - (days - 1));

      const sessions = await StudySession.findAll({
        where: {
          user_id: req.user.id,
          start_time: { [Op.between]: [start, end] },
        },
        attributes: ["start_time", "duration_seconds"],
        raw: true,
      });

      // Bucket in JS to avoid dialect-specific date functions (works across
      // sqlite/postgres/mysql identically).
      const buckets = new Map();
      for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        buckets.set(key, { date: key, total_seconds: 0, session_count: 0 });
      }
      for (const row of sessions) {
        const key = new Date(row.start_time).toISOString().slice(0, 10);
        const bucket = buckets.get(key);
        if (bucket) {
          bucket.total_seconds += Number(row.duration_seconds) || 0;
          bucket.session_count += 1;
        }
      }

      return res.status(200).json({
        success: true,
        data: { timeline: Array.from(buckets.values()) },
      });
    } catch (error) {
      console.error("Get study timeline error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Paginated list of past sessions (newest first)
   */
  const listSessions = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, msg: "User not authenticated" });
      }

      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const offset = (page - 1) * limit;

      const { rows, count } = await StudySession.findAndCountAll({
        where: { user_id: req.user.id },
        order: [["start_time", "DESC"]],
        limit,
        offset,
        include: [
          { model: Note, as: "note", attributes: ["id", "title"], required: false },
          { model: MindMap, as: "mindMap", attributes: ["id", "title"], required: false },
        ],
      });

      return res.status(200).json({
        success: true,
        data: {
          sessions: rows,
          pagination: {
            page,
            limit,
            total: count,
            total_pages: Math.ceil(count / limit) || 1,
          },
        },
      });
    } catch (error) {
      console.error("List study sessions error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Delete a session by id (must belong to user)
   */
  const deleteSession = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, msg: "User not authenticated" });
      }

      const id = parseInt(req.params.id, 10);
      if (!id) {
        return res.status(400).json({ success: false, msg: "Session id is required" });
      }

      const session = await StudySession.findOne({
        where: { id, user_id: req.user.id },
      });
      if (!session) {
        return res.status(404).json({ success: false, msg: "Session not found" });
      }

      await session.destroy();
      return res.status(200).json({ success: true, msg: "Session deleted" });
    } catch (error) {
      console.error("Delete study session error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  return {
    createSession,
    getToday,
    getWeek,
    getStats,
    getTimeline,
    listSessions,
    deleteSession,
  };
};

module.exports = StudySessionController();
