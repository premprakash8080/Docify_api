const Sequelize = require("sequelize");
const database = require("../config/database");
const {
  TABLE_NAME_FILES,
  TABLE_NAME_USERS,
  TABLE_NAME_NOTES,
} = require("../config/table_names");

const File = database.define(
  TABLE_NAME_FILES,
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
    note_id: {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: TABLE_NAME_NOTES,
        key: "id",
      },
    },
    firebase_storage_path: {
      type: Sequelize.STRING(500),
      allowNull: false,
    },
    filename: {
      type: Sequelize.STRING(500),
      allowNull: false,
    },
    mime_type: {
      type: Sequelize.STRING(100),
      allowNull: false,
    },
    size: {
      type: Sequelize.BIGINT,
      allowNull: false,
    },
    description: {
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
  },
  {
    tableName: TABLE_NAME_FILES,
    underscored: true,
  }
);

module.exports = File;


