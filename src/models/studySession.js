const Sequelize = require("sequelize");
const database = require("../config/database");
const {
  TABLE_NAME_STUDY_SESSIONS,
  TABLE_NAME_USERS,
  TABLE_NAME_NOTES,
  TABLE_NAME_MINDMAPS,
} = require("../config/table_names");

const StudySession = database.define(
  TABLE_NAME_STUDY_SESSIONS,
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
      onDelete: "CASCADE",
    },
    note_id: {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: TABLE_NAME_NOTES, key: "id" },
      onDelete: "SET NULL",
    },
    mind_map_id: {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: TABLE_NAME_MINDMAPS, key: "id" },
      onDelete: "SET NULL",
    },
    title: {
      type: Sequelize.STRING(500),
      allowNull: true,
    },
    start_time: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    end_time: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    duration_seconds: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    session_type: {
      type: Sequelize.ENUM("note", "mind_map", "general"),
      allowNull: false,
      defaultValue: "general",
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
    tableName: TABLE_NAME_STUDY_SESSIONS,
    underscored: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["user_id", "start_time"] },
      { fields: ["note_id"] },
      { fields: ["mind_map_id"] },
    ],
  }
);

module.exports = StudySession;
