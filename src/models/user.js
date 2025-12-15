const Sequelize = require("sequelize");
const database = require("../config/database");
const { TABLE_NAME_USERS } = require("../config/table_names");

// Related models for associations
const Stack = require("./stack");
const Notebook = require("./notebook");
const Tag = require("./tag");
const Note = require("./note");
const File = require("./file");
const UserSetting = require("./userSetting");

const User = database.define(
  TABLE_NAME_USERS,
  {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    firebase_uid: {
      type: Sequelize.STRING(128),
      allowNull: false,
      unique: true,
    },
    auth_provider: {
      type: Sequelize.ENUM("google", "email"),
      allowNull: false,
      defaultValue: "google",
    },
    password_hash: {
      type: Sequelize.STRING(255),
      allowNull: true, // null for Google users, hashed password for email users
    },
    email: {
      type: Sequelize.STRING(255),
      allowNull: false,
    },
    display_name: {
      type: Sequelize.STRING(255),
      allowNull: true,
    },
    avatar_url: {
      type: Sequelize.TEXT,
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
    last_login_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    is_active: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: TABLE_NAME_USERS,
    underscored: true,
  }
);

// Relationships:
// User 1 - N Stack
// User 1 - N Notebook
// User 1 - N Tag
// User 1 - N Note
// User 1 - N File
// User 1 - N UserSetting
User.hasMany(Stack, { foreignKey: "user_id", as: "stacks" });
User.hasMany(Notebook, { foreignKey: "user_id", as: "notebooks" });
User.hasMany(Tag, { foreignKey: "user_id", as: "tags" });
User.hasMany(Note, { foreignKey: "user_id", as: "notes" });
User.hasMany(File, { foreignKey: "user_id", as: "files" });
User.hasMany(UserSetting, { foreignKey: "user_id", as: "settings" });

module.exports = User;


