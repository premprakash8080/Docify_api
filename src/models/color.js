const Sequelize = require("sequelize");
const database = require("../config/database");
const { TABLE_NAME_COLORS } = require("../config/table_names");

const Color = database.define(
  TABLE_NAME_COLORS,
  {
    id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: Sequelize.STRING(100),
      allowNull: false,
      unique: true,
    },
    hex_code: {
      type: Sequelize.STRING(7),
      allowNull: false,
      unique: true,
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
    tableName: TABLE_NAME_COLORS,
    underscored: true,
  }
);

module.exports = Color;

