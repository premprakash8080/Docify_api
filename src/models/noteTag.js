const Sequelize = require("sequelize");
const database = require("../config/database");
const {
  TABLE_NAME_NOTE_TAGS,
  TABLE_NAME_NOTES,
  TABLE_NAME_TAGS,
} = require("../config/table_names");

const NoteTag = database.define(
  TABLE_NAME_NOTE_TAGS,
  {
    id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    note_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: TABLE_NAME_NOTES,
        key: "id",
      },
    },
    tag_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: TABLE_NAME_TAGS,
        key: "id",
      },
    },
    created_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
    },
  },
  {
    tableName: TABLE_NAME_NOTE_TAGS,
    underscored: true,
    indexes: [
      // Tag→note lookups (the "notes with tag X" filter) and note→tag
      // lookups (sidebar tag chips) are both hot paths.
      { fields: ["note_id"] },
      { fields: ["tag_id"] },
      { unique: true, fields: ["note_id", "tag_id"] },
    ],
  }
);

module.exports = NoteTag;


