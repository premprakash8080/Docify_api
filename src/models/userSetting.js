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
      references: {
        model: TABLE_NAME_USERS,
        key: "id",
      },
    },
    setting_key: {
      type: Sequelize.STRING(100),
      allowNull: false,
    },
    setting_value: {
      type: Sequelize.STRING(255),
      allowNull: true,
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


