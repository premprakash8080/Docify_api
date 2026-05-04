const Sequelize = require("sequelize");
const database = require("../config/database");
const {
  TABLE_NAME_NOTIFICATIONS,
  TABLE_NAME_USERS,
} = require("../config/table_names");

/**
 * Per-user notification record. The `type` field is a free-form string —
 * "reminder", "share", "task_due", etc. — and `related_type` / `related_id`
 * point at the originating entity so the UI can deep-link.
 */
const Notification = database.define(
  TABLE_NAME_NOTIFICATIONS,
  {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: TABLE_NAME_USERS, key: "id" },
    },
    type: {
      type: Sequelize.STRING(64),
      allowNull: false,
      defaultValue: "info",
    },
    title: {
      type: Sequelize.STRING(255),
      allowNull: false,
    },
    body: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    link: {
      type: Sequelize.STRING(512),
      allowNull: true,
    },
    is_read: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    read_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    related_type: {
      type: Sequelize.STRING(64),
      allowNull: true,
    },
    related_id: {
      type: Sequelize.STRING(128),
      allowNull: true,
    },
    created_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
    },
    updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
    },
  },
  {
    tableName: TABLE_NAME_NOTIFICATIONS,
    underscored: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["user_id", "is_read"] },
      { fields: ["user_id", "created_at"] },
    ],
  }
);

module.exports = Notification;
