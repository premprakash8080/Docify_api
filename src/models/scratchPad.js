const Sequelize = require("sequelize");
const database = require("../config/database");
const {
  TABLE_NAME_SCRATCH_PAD,
  TABLE_NAME_USERS,
} = require("../config/table_names");

const ScratchPad = database.define(
  TABLE_NAME_SCRATCH_PAD,
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
      unique: true, // Ensure one scratch pad per user
      references: {
        model: TABLE_NAME_USERS,
        key: "id",
      },
    },
    content: {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: "",
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
    tableName: TABLE_NAME_SCRATCH_PAD,
    underscored: true,
  }
);

module.exports = ScratchPad;

