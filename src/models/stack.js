const Sequelize = require("sequelize");
const database = require("../config/database");
const {
  TABLE_NAME_STACKS,
  TABLE_NAME_USERS,
  TABLE_NAME_COLORS,
} = require("../config/table_names");

const Notebook = require("./notebook");
const Color = require("./color");

const Stack = database.define(
  TABLE_NAME_STACKS,
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
    tableName: TABLE_NAME_STACKS,
    underscored: true,
  }
);

// Relationships:
// Stack 1 - N Notebook
// Stack N - 1 Color
Stack.hasMany(Notebook, { foreignKey: "stack_id", as: "notebooks" });
Stack.belongsTo(Color, { foreignKey: "color_id", as: "color" });

module.exports = Stack;


