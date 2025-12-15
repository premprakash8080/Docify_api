const Sequelize = require("sequelize");
const database = require("../config/database");
const {
  TABLE_NAME_TASKS,
  TABLE_NAME_NOTES,
} = require("../config/table_names");

const Task = database.define(
  TABLE_NAME_TASKS,
  {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
    },
    note_id: {
      type: Sequelize.UUID,
      allowNull: false,
      comment: "Parent note ID (FK to notes.id)",
      references: {
        model: TABLE_NAME_NOTES,
        key: "id",
      },
    },
    label: {
      type: Sequelize.STRING(255),
      allowNull: false,
      comment: "Task label/description",
    },
    completed: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Task completion status",
    },
    sort_order: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Display order within note",
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
  }
);

// Relationships:
// Task N - 1 Note

module.exports = Task;


