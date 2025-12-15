const Sequelize = require("sequelize");
const database = require("../config/database");

const NotebookSummaryView = database.define(
  "notebook_summary_view",
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
    stack_id: {
      type: Sequelize.UUID,
      allowNull: true,
    },
    name: {
      type: Sequelize.STRING(255),
      allowNull: false,
    },
    description: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    color_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    color_hex: {
      type: Sequelize.STRING(7),
      allowNull: true,
    },
    color_name: {
      type: Sequelize.STRING(100),
      allowNull: true,
    },
    sort_order: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    updated_at: {
      type: Sequelize.DATE,
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
    note_count: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    pinned_notes: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    archived_notes: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "notebook_summary_view",
    underscored: true,
    timestamps: false, // Views don't have timestamps that can be updated
    freezeTableName: true, // Prevent Sequelize from pluralizing the view name
  }
);

// Note: This is a read-only view model
// No associations or write operations should be performed on this model

module.exports = NotebookSummaryView;

