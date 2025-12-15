const Sequelize = require("sequelize");
const database = require("../config/database");

const NoteSummaryView = database.define(
  "note_summary_view",
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
    created_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    // Aggregated statistics
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
    total_file_size: {
      type: Sequelize.BIGINT,
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
    task_completion_percentage: {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "note_summary_view",
    underscored: true,
    timestamps: false,
    freezeTableName: true,
  }
);

// Note: This is a read-only view model
// No associations or write operations should be performed on this model

module.exports = NoteSummaryView;

