const Sequelize = require("sequelize");
const database = require("../config/database");
const {
  TABLE_NAME_TAGS,
  TABLE_NAME_USERS,
  TABLE_NAME_COLORS,
} = require("../config/table_names");

const Tag = database.define(
  TABLE_NAME_TAGS,
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
      references: {
        model: TABLE_NAME_USERS,
        key: "id",
      },
    },
    name: {
      type: Sequelize.STRING(255),
      allowNull: false,
    },
    color_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: TABLE_NAME_COLORS,
        key: "id",
      },
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
    tableName: TABLE_NAME_TAGS,
    underscored: true,
  }
);

module.exports = Tag;


