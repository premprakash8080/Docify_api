const { admin } = require("./firebase");
const User = require("../models/user");

/**
 * Middleware to verify Firebase ID token and sync user to MySQL
 * This middleware:
 * 1. Verifies the Firebase ID token from Authorization header
 * 2. Extracts firebase_uid from the token
 * 3. Finds or creates user in MySQL database
 * 4. Attaches user to req.user for use in routes
 */
module.exports = async (req, res, next) => {
  try {
    // Check for Authorization header
    if (!req.headers || !req.headers.authorization) {
      return res.status(401).json({
        success: false,
        msg: "Unauthorized: No token provided",
      });
    }

    // Extract token from "Bearer <token>"
    const token = req.headers.authorization.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        msg: "Unauthorized: Invalid token format",
      });
    }

    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Extract user info from Firebase token
    const firebase_uid = decodedToken.uid;
    const email = decodedToken.email || null;
    const display_name = decodedToken.name || null;
    const avatar_url = decodedToken.picture || null;

    // Find or create user in MySQL
    let user = await User.findOne({
      where: { firebase_uid: firebase_uid },
    });

    if (!user) {
      // Create new user if doesn't exist
      user = await User.create({
        firebase_uid: firebase_uid,
        email: email,
        display_name: display_name,
        avatar_url: avatar_url,
        is_active: true,
      });
    } else {
      // Update existing user info and last_login_at
      await user.update({
        email: email,
        display_name: display_name || user.display_name,
        avatar_url: avatar_url || user.avatar_url,
        last_login_at: new Date(),
      });
    }

    // Attach user to request object
    req.user = user;
    req.firebase_uid = firebase_uid;

    next();
  } catch (error) {
    console.error("Firebase auth error:", error);
    return res.status(401).json({
      success: false,
      msg: "Unauthorized: Invalid or expired token",
      error: error.message,
    });
  }
};

