const Sequelize = require("sequelize");
const database = require("../config/database");
const {
  TABLE_NAME_NOTES,
  TABLE_NAME_USERS,
  TABLE_NAME_NOTE_SHARES,
} = require("../config/table_names");

const NoteShare = database.define(
  TABLE_NAME_NOTE_SHARES,
  {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
    },
    note_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: TABLE_NAME_NOTES, key: "id" },
      onDelete: "CASCADE",
    },
    owner_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: TABLE_NAME_USERS, key: "id" },
    },
    shared_with_user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: TABLE_NAME_USERS, key: "id" },
    },
    permission: {
      type: Sequelize.ENUM("view", "edit"),
      allowNull: false,
      defaultValue: "view",
    },
    created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
  },
  {
    tableName: TABLE_NAME_NOTE_SHARES,
    underscored: true,
    indexes: [
      { unique: true, fields: ["note_id", "shared_with_user_id"] },
      { fields: ["shared_with_user_id"] },
      { fields: ["owner_id"] },
    ],
  }
);

module.exports = NoteShare;
