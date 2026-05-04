const Sequelize = require("sequelize");
const database = require("../config/database");
const {
  TABLE_NAME_CLIPPER_OTPS,
  TABLE_NAME_USERS,
} = require("../config/table_names");

/**
 * One-time codes used by the Web Clipper Chrome extension to swap an
 * authenticated browser session for a long-lived JWT.
 *
 * Flow:
 *   1. Frontend `/clipper-connect` view (with the user already signed in)
 *      hits POST /api/clipper/issue-otp → backend writes a new row here
 *      with hash(code), user_id, expires_at = now + 60s.
 *   2. Frontend posts the raw code back to the extension popup via
 *      window.opener.postMessage.
 *   3. Extension calls POST /api/clipper/exchange { otp } → backend
 *      hashes the supplied code, looks up the row, marks it used,
 *      issues a JWT for that user_id.
 *
 * Rows are single-use and short-lived (TTL ≤ 60s). A periodic cleanup
 * pass in the controller deletes anything used or expired.
 */
const ClipperOtp = database.define(
  TABLE_NAME_CLIPPER_OTPS,
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
      references: { model: TABLE_NAME_USERS, key: "id" },
      onDelete: "CASCADE",
    },
    // SHA-256 hex of the raw OTP. We never store the raw code so a DB leak
    // doesn't compromise active sign-ins (codes also expire fast).
    otp_hash: {
      type: Sequelize.STRING(64),
      allowNull: false,
    },
    expires_at: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    used_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    // Audit metadata — useful for debugging "why didn't my sign-in work?".
    extension_id: {
      type: Sequelize.STRING(64),
      allowNull: true,
    },
    created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
  },
  {
    tableName: TABLE_NAME_CLIPPER_OTPS,
    underscored: true,
    indexes: [
      { fields: ["otp_hash"], unique: true },
      { fields: ["user_id"] },
      // Cleanup pass scans by expires_at to GC old rows.
      { fields: ["expires_at"] },
    ],
  }
);

module.exports = ClipperOtp;
