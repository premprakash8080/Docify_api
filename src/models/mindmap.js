const Sequelize = require("sequelize");
const database = require("../config/database");
const {
  TABLE_NAME_MINDMAPS,
  TABLE_NAME_USERS,
} = require("../config/table_names");

const MindMap = database.define(
  TABLE_NAME_MINDMAPS,
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
      references: { model: TABLE_NAME_USERS, key: "id" },
      onDelete: "CASCADE",
    },
    title: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: "Untitled mind map",
    },
    // Locked at creation time. Allowed values: 'mindmap' | 'orgchart' | 'knowledgemap'.
    // Stored as STRING (not ENUM) so adding a new layout later doesn't need a
    // migration; the controller validates the value on write.
    layout_type: {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: "mindmap",
    },
    nodes: {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: [],
    },
    edges: {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: [],
    },
    created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
  },
  {
    tableName: TABLE_NAME_MINDMAPS,
    underscored: true,
    indexes: [{ fields: ["user_id"] }],
  }
);

module.exports = MindMap;
