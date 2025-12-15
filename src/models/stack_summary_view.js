const Sequelize = require("sequelize");
const database = require("../config/database");

const StackSummaryView = database.define(
  "stack_summary_view",
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
    // Aggregated counts
    notebook_count: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    total_notes: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "stack_summary_view",
    underscored: true,
    timestamps: false,
    freezeTableName: true,
  }
);

// Note: This is a read-only view model
// No associations or write operations should be performed on this model

module.exports = StackSummaryView;

