const { Op } = require("sequelize");
const Notification = require("../models/notification");

/**
 * List notifications for the authenticated user. Supports `?unread=true`
 * and `?limit=` (default 50, max 200). Newest first.
 */
const list = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, msg: "Unauthorized" });
    }

    const unreadOnly = String(req.query.unread || "").toLowerCase() === "true";
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 50, 1),
      200
    );

    const where = { user_id: userId };
    if (unreadOnly) where.is_read = false;

    const rows = await Notification.findAll({
      where,
      order: [["created_at", "DESC"]],
      limit,
    });

    return res.status(200).json({
      success: true,
      msg: "Notifications fetched",
      data: { notifications: rows },
    });
  } catch (error) {
    console.error("[notifications/list] error:", error);
    return res.status(500).json({
      success: false,
      msg: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

const unreadCount = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, msg: "Unauthorized" });
    }
    const count = await Notification.count({
      where: { user_id: userId, is_read: false },
    });
    return res.status(200).json({
      success: true,
      msg: "Unread count",
      data: { count },
    });
  } catch (error) {
    console.error("[notifications/unread-count] error:", error);
    return res.status(500).json({
      success: false,
      msg: "Failed to fetch unread count",
      error: error.message,
    });
  }
};

const markRead = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, msg: "Unauthorized" });
    }
    const { id } = req.params;
    const notif = await Notification.findOne({
      where: { id, user_id: userId },
    });
    if (!notif) {
      return res
        .status(404)
        .json({ success: false, msg: "Notification not found" });
    }
    if (!notif.is_read) {
      await notif.update({ is_read: true, read_at: new Date() });
    }
    return res
      .status(200)
      .json({ success: true, msg: "Marked as read", data: { notification: notif } });
  } catch (error) {
    console.error("[notifications/mark-read] error:", error);
    return res.status(500).json({
      success: false,
      msg: "Failed to mark as read",
      error: error.message,
    });
  }
};

const markAllRead = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, msg: "Unauthorized" });
    }
    const [updated] = await Notification.update(
      { is_read: true, read_at: new Date() },
      { where: { user_id: userId, is_read: false } }
    );
    return res.status(200).json({
      success: true,
      msg: "Marked all as read",
      data: { updated },
    });
  } catch (error) {
    console.error("[notifications/mark-all-read] error:", error);
    return res.status(500).json({
      success: false,
      msg: "Failed to mark all as read",
      error: error.message,
    });
  }
};

const remove = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, msg: "Unauthorized" });
    }
    const { id } = req.params;
    const deleted = await Notification.destroy({
      where: { id, user_id: userId },
    });
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, msg: "Notification not found" });
    }
    return res
      .status(200)
      .json({ success: true, msg: "Notification deleted" });
  } catch (error) {
    console.error("[notifications/delete] error:", error);
    return res.status(500).json({
      success: false,
      msg: "Failed to delete notification",
      error: error.message,
    });
  }
};

/**
 * Server-side helper for other controllers — e.g. when a note is shared,
 * call `createNotification({ userId, type: 'share', title: ..., link: ... })`
 * to drop a notification into the recipient's bell.
 */
const createNotification = async ({
  userId,
  type = "info",
  title,
  body = null,
  link = null,
  relatedType = null,
  relatedId = null,
}) => {
  if (!userId || !title) return null;
  return Notification.create({
    user_id: userId,
    type,
    title,
    body,
    link,
    related_type: relatedType,
    related_id: relatedId == null ? null : String(relatedId),
  });
};

// Avoid the unused-warning for Op while keeping the import handy for
// future producers (e.g. filtering by created_at >= NOW() - 30d).
void Op;

module.exports = {
  list,
  unreadCount,
  markRead,
  markAllRead,
  remove,
  createNotification,
};
