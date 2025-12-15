const Sequelize = require("sequelize");
const database = require("../config/database");

const NoteListView = database.define(
  "note_list_view",
  {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    notebook_id: {
      type: Sequelize.UUID,
      allowNull: true,
    },
    firebase_document_id: {
      type: Sequelize.STRING(255),
      allowNull: false,
    },
    title: {
      type: Sequelize.STRING(500),
      allowNull: false,
    },
    pinned: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    archived: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    trashed: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    version: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    synced: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    last_modified: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    // Notebook information
    notebook_name: {
      type: Sequelize.STRING(255),
      allowNull: true,
    },
    notebook_description: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    notebook_color_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    notebook_color_hex: {
      type: Sequelize.STRING(7),
      allowNull: true,
    },
    notebook_color_name: {
      type: Sequelize.STRING(100),
      allowNull: true,
    },
    // Stack information
    stack_id: {
      type: Sequelize.UUID,
      allowNull: true,
    },
    stack_name: {
      type: Sequelize.STRING(255),
      allowNull: true,
    },
    stack_description: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    stack_color_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    stack_color_hex: {
      type: Sequelize.STRING(7),
      allowNull: true,
    },
    stack_color_name: {
      type: Sequelize.STRING(100),
      allowNull: true,
    },
    // User information
    user_email: {
      type: Sequelize.STRING(255),
      allowNull: true,
    },
    user_display_name: {
      type: Sequelize.STRING(255),
      allowNull: true,
    },
    // Aggregated counts
    tag_count: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    file_count: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    task_count: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    completed_task_count: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "note_list_view",
    underscored: true,
    timestamps: false,
    freezeTableName: true,
  }
);

// Note: This is a read-only view model
// No associations or write operations should be performed on this model

module.exports = NoteListView;

