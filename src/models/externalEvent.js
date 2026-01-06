const Sequelize = require("sequelize");
const database = require("../config/database");
const {
  TABLE_NAME_EXTERNAL_EVENTS,
  TABLE_NAME_USERS,
} = require("../config/table_names");

const ExternalEvent = database.define(
  TABLE_NAME_EXTERNAL_EVENTS,
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
      comment: "User ID (FK to users.id)",
      references: {
        model: TABLE_NAME_USERS,
        key: "id",
      },
    },
    title: {
      type: Sequelize.STRING(255),
      allowNull: false,
    },
    variant: {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: "primary",
      comment: "Variant for UI styling (primary, secondary, success, etc.)",
    },
    description: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    priority: {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: "Priority level: low, medium, high",
    },
    start_time: {
      type: Sequelize.TIME,
      allowNull: true,
      comment: "Default start time (HH:MM format)",
    },
    end_time: {
      type: Sequelize.TIME,
      allowNull: true,
      comment: "Default end time (HH:MM format)",
    },
    reminder: {
      type: Sequelize.TIME,
      allowNull: true,
      comment: "Default reminder time (HH:MM format)",
    },
    assigned_to: {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: "Default assigned user ID or email",
    },
    flagged: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    tableName: TABLE_NAME_EXTERNAL_EVENTS,
    underscored: true,
  }
);

module.exports = ExternalEvent;

