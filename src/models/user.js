const Sequelize = require("sequelize");
const database = require("../config/database");
const { TABLE_NAME_USERS } = require("../config/table_names");
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

// Automatically create default user settings after a new user is created
User.afterCreate(async (user, options) => {
  try {
    await UserSetting.findOrCreate({
      where: { user_id: user.id },
      defaults: {
        theme_layout: "default",
        theme_color: "light",
        corners: "rounded",
        button_style: "solid",
      },
    });
  } catch (error) {
    console.error("Error creating default user settings:", error);
  }
});

module.exports = User;


