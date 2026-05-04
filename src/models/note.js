const Sequelize = require("sequelize");
const database = require("../config/database");
const {
  TABLE_NAME_NOTES,
  TABLE_NAME_USERS,
  TABLE_NAME_NOTEBOOKS,
} = require("../config/table_names");

const Note = database.define(
  TABLE_NAME_NOTES,
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
    notebook_id: {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: TABLE_NAME_NOTEBOOKS,
        key: "id",
      },
    },
    firebase_document_id: {
      type: Sequelize.STRING(255),
      allowNull: false,
      unique: true,
    },
    title: {
      type: Sequelize.STRING(500),
      allowNull: false,
    },
    pinned: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    archived: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    trashed: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    version: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    synced: {
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
    last_modified: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    // Web Clipper provenance — populated only by the Docify Web Clipper
    // extension. Notes typed inside the app leave these null, so a future
    // "My Web Clips" filter can simply match on `clipped_at IS NOT NULL`.
    source_url: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    clip_type: {
      // Stored as STRING (not ENUM) so a new clip mode (e.g. screenshot)
      // can be added later without a schema migration; controller validates.
      type: Sequelize.STRING(32),
      allowNull: true,
    },
    og_image_url: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    clipped_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
  },
  {
    tableName: TABLE_NAME_NOTES,
    underscored: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["notebook_id"] },
      // Composite covers the common "list user's notes (filtered out trash)
      // sorted by recency" pattern that powers the sidebar.
      { fields: ["user_id", "trashed", "updated_at"] },
      // Powers a future "Web Clips" sidebar item — only rows where
      // clipped_at is non-null, sorted newest first.
      { fields: ["user_id", "clipped_at"] },
    ],
  }
);

module.exports = Note;


