const Sequelize = require("sequelize");
const database = require("../config/database");
const {
  TABLE_NAME_NOTE_COMMENTS,
  TABLE_NAME_NOTES,
  TABLE_NAME_USERS,
} = require("../config/table_names");

/**
 * Threaded comments on a note. `parent_id` is null for top-level comments
 * and points at another note_comments row for replies. Replies are kept
 * shallow (single level) at the application layer for now — the schema
 * itself is general so deeper threads remain possible later.
 *
 * Soft-delete via `is_deleted` so a deleted parent doesn't orphan its
 * replies; the UI renders deleted comments as "[deleted]".
 */
const NoteComment = database.define(
  TABLE_NAME_NOTE_COMMENTS,
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
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: TABLE_NAME_USERS, key: "id" },
    },
    parent_id: {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: TABLE_NAME_NOTE_COMMENTS, key: "id" },
      onDelete: "CASCADE",
    },
    body: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    is_deleted: {
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
    tableName: TABLE_NAME_NOTE_COMMENTS,
    underscored: true,
    indexes: [
      { fields: ["note_id"] },
      { fields: ["note_id", "parent_id"] },
      { fields: ["user_id"] },
    ],
  }
);

module.exports = NoteComment;
