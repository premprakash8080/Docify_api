const crypto = require("crypto");
const { Op } = require("sequelize");
const ClipperOtp = require("../models/clipperOtp");
const User = require("../models/user");
const { issueJWT } = require("../utils/issueJWT");

/**
 * Web Clipper authentication bridge.
 *
 * The browser extension can't run a real OAuth flow without a public
 * redirect URI, and we don't want users pasting raw JWTs from devtools.
 * Instead:
 *
 *   1. The extension popup opens the Docify web app at /clipper-connect.
 *      The user is already signed in, so the page can call POST
 *      /api/clipper/issue-otp to get a one-time code (60-second TTL).
 *   2. The web page postMessages the OTP back to the popup, then closes.
 *   3. The popup calls POST /api/clipper/exchange { otp } to swap the
 *      OTP for the real long-lived JWT.
 *
 * The OTP is hashed at rest (SHA-256). On exchange we mark it used and
 * GC any stale rows for the same user.
 */

// 60 seconds is plenty for the postMessage round-trip and short enough
// that a leaked code is functionally useless.
const OTP_TTL_MS = 60 * 1000;

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

// 9-char human-friendly OTP (4 + 4 with hyphen). 36^8 ≈ 2.8e12 possibilities
// — within a 60s window an attacker would need ~50k req/sec to land one;
// the issue-otp endpoint is auth-gated so they need a session first anyway.
const generateOtp = () => {
  const buf = crypto.randomBytes(8);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // skip ambiguous I/O/0/1
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[buf[i] % alphabet.length];
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
};

const ClipperController = () => {
  /**
   * @description Issue a one-time code that the extension can later swap
   *   for a JWT. Caller must already be authenticated in the web app.
   * @param req.user - From jwtVerify middleware
   * @param req.body.extension_id - Optional Chrome extension id (for audit)
   * @returns { otp, expires_in }
   */
  const issueOtp = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, msg: "Unauthorized" });
      }

      // Best-effort GC: drop any rows for this user that are already
      // expired or used. Keeps the table small without a cron job.
      try {
        await ClipperOtp.destroy({
          where: {
            user_id: req.user.id,
            [Op.or]: [
              { expires_at: { [Op.lt]: new Date() } },
              { used_at: { [Op.ne]: null } },
            ],
          },
        });
      } catch (_gcErr) {
        // Cleanup failure shouldn't block issuing a new OTP.
      }

      // Tiny retry loop in case of an astronomical collision on otp_hash.
      let lastErr = null;
      for (let i = 0; i < 5; i++) {
        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + OTP_TTL_MS);
        try {
          await ClipperOtp.create({
            user_id: req.user.id,
            otp_hash: sha256(otp),
            expires_at: expiresAt,
            extension_id: req.body?.extension_id
              ? String(req.body.extension_id).slice(0, 64)
              : null,
          });
          return res.status(201).json({
            success: true,
            data: {
              otp,
              expires_in: Math.round(OTP_TTL_MS / 1000),
            },
          });
        } catch (err) {
          lastErr = err;
          // Unique constraint violation on otp_hash — retry with a fresh code.
        }
      }
      throw lastErr || new Error("Could not issue OTP");
    } catch (error) {
      console.error("Clipper issue OTP error:", error);
      return res.status(500).json({
        success: false,
        msg: "Could not issue clipper code",
      });
    }
  };

  /**
   * @description Swap a one-time code for a long-lived JWT. No auth — the
   *   OTP itself is the credential. Single-use.
   * @param req.body.otp - The OTP issued by /issue-otp
   * @returns { token, user }
   */
  const exchange = async (req, res) => {
    try {
      const otp = req.body?.otp;
      if (!otp || typeof otp !== "string" || otp.length < 6 || otp.length > 32) {
        return res.status(400).json({
          success: false,
          msg: "Missing or malformed otp",
        });
      }

      const row = await ClipperOtp.findOne({
        where: { otp_hash: sha256(otp.trim()) },
      });

      if (!row) {
        return res.status(404).json({
          success: false,
          msg: "Code not found",
        });
      }

      if (row.used_at) {
        return res.status(409).json({
          success: false,
          msg: "Code already used",
        });
      }

      if (new Date(row.expires_at).getTime() < Date.now()) {
        return res.status(410).json({
          success: false,
          msg: "Code expired",
        });
      }

      // Mark used BEFORE issuing the JWT so a concurrent exchange request
      // for the same OTP loses the race and returns 409.
      const [updated] = await ClipperOtp.update(
        { used_at: new Date() },
        {
          where: {
            id: row.id,
            used_at: null,
          },
        }
      );
      if (updated === 0) {
        return res.status(409).json({
          success: false,
          msg: "Code already used",
        });
      }

      const user = await User.findOne({
        where: { id: row.user_id },
        attributes: ["id", "email", "display_name", "is_active", "role"],
      });
      if (!user || !user.is_active) {
        return res.status(403).json({
          success: false,
          msg: "User no longer active",
        });
      }

      const { token, expires } = issueJWT(user.id, user.role);

      return res.status(200).json({
        success: true,
        data: {
          token,
          expires,
          user: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
          },
        },
      });
    } catch (error) {
      console.error("Clipper exchange error:", error);
      return res.status(500).json({
        success: false,
        msg: "Could not exchange clipper code",
      });
    }
  };

  return { issueOtp, exchange };
};

module.exports = ClipperController();
