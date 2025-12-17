const Sequelize = require("sequelize");
const database = require("../config/database");

const { TABLE_NAME_TEMPLATES, TABLE_NAME_USERS } = require("../config/table_names");

const Template = database.define(
  TABLE_NAME_TEMPLATES,
  {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
    },

    user_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
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
      type: Sequelize.STRING(500),
      allowNull: true,
    },

    image_url: {
      type: Sequelize.STRING(255),
      allowNull: true,
    },

    content: {
      type: Sequelize.TEXT("long"),
      allowNull: false,
    },

    content_type: {
      type: Sequelize.ENUM("tiptap", "html", "markdown"),
      allowNull: false,
      defaultValue: "tiptap",
    },

    is_system: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    tableName: TABLE_NAME_TEMPLATES,
    underscored: true,
  }
);

module.exports = Template;
