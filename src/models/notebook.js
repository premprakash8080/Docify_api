const Sequelize = require("sequelize");
const database = require("../config/database");
const {
  TABLE_NAME_NOTEBOOKS,
  TABLE_NAME_USERS,
  TABLE_NAME_STACKS,
  TABLE_NAME_COLORS,
} = require("../config/table_names");

const Note = require("./note");
const Color = require("./color");

const Notebook = database.define(
  TABLE_NAME_NOTEBOOKS,
  {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: TABLE_NAME_USERS,
        key: "id",
      },
    },
    stack_id: {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: TABLE_NAME_STACKS,
        key: "id",
      },
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
      references: {
        model: TABLE_NAME_COLORS,
        key: "id",
      },
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
    tableName: TABLE_NAME_NOTEBOOKS,
    underscored: true,
  }
);

// Relationships:
// Notebook 1 - N Note
// Notebook N - 1 Color
Notebook.hasMany(Note, { foreignKey: "notebook_id", as: "notes" });
Notebook.belongsTo(Color, { foreignKey: "color_id", as: "color" });

module.exports = Notebook;


