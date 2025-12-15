const Sequelize = require("sequelize");
const database = require("../config/database");

const UserStatsView = database.define(
  "user_stats_view",
  {
    user_id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    email: {
      type: Sequelize.STRING(255),
      allowNull: false,
    },
    display_name: {
      type: Sequelize.STRING(255),
      allowNull: true,
    },
    is_active: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    user_created_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    last_login_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    // Counts
    total_notes: {
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
    trashed_notes: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    total_notebooks: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    total_stacks: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    total_tags: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    total_files: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    total_file_size: {
      type: Sequelize.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    total_tasks: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    completed_tasks: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "user_stats_view",
    underscored: true,
    timestamps: false,
    freezeTableName: true,
  }
);

// Note: This is a read-only view model
// No associations or write operations should be performed on this model

module.exports = UserStatsView;

