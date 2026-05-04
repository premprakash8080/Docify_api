const Sequelize = require("sequelize");
const database = require("../config/database");
const {
  TABLE_NAME_TASKS,
  TABLE_NAME_NOTES,
  TABLE_NAME_USERS,
} = require("../config/table_names");

const Task = database.define(
  TABLE_NAME_TASKS,
  {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    // Direct user ownership — lets standalone tasks (without a note) still be
    // scoped to the creator and shown on their calendar.
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: true, // nullable for safe migration; backfilled in initiatePreData
      references: {
        model: TABLE_NAME_USERS,
        key: "id",
      },
    },
    note_id: {
      type: Sequelize.UUID,
      allowNull: true,
      comment: "Parent note ID (FK to notes.id)",
      references: {
        model: TABLE_NAME_NOTES,
        key: "id",
      },
    },
    label: {
      type: Sequelize.STRING(255),
      allowNull: false,
    },
    description: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    start_date: {
      type: Sequelize.DATEONLY,
      allowNull: true,
    },
    start_time: {
      type: Sequelize.TIME,
      allowNull: true,
    },
    end_time: {
      type: Sequelize.TIME,
      allowNull: true,
    },
    reminder: {
      type: Sequelize.STRING(255),
      allowNull: true,
    },
    assigned_to: {
      type: Sequelize.STRING(255),
      allowNull: true,
    },
    priority: {
      type: Sequelize.STRING(50),
      allowNull: true,
    },
    flagged: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    completed: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    sort_order: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
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
    tableName: TABLE_NAME_TASKS,
    underscored: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["note_id"] },
      // Time-slot conflict checks query by (user_id, start_date) constantly.
      { fields: ["user_id", "start_date"] },
    ],
  }
);

module.exports = Task;


