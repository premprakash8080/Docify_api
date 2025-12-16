const Sequelize = require("sequelize");
const database = require("../config/database");
const {
  TABLE_NAME_USER_SETTINGS,
  TABLE_NAME_USERS,
} = require("../config/table_names");

const UserSetting = database.define(
  TABLE_NAME_USER_SETTINGS,
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
      unique: true, // Ensure one settings row per user
      references: {
        model: TABLE_NAME_USERS,
        key: "id",
      },
    },
    // Theme/layout settings - one row per user
    theme_layout: {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: "default",
    },
    theme_color: {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: "light",
    },
    corners: {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: "rounded",
    },
    button_style: {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: "solid",
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
    tableName: TABLE_NAME_USER_SETTINGS,
    underscored: true,
  }
);

module.exports = UserSetting;


