const jwt = require("jsonwebtoken");
const UserModel = require("../models/user");
const { JWT_PRIVATE_KEY } = process.env;

/**
 * JWT Authentication Middleware
 * Verifies JWT token from Authorization header and attaches user to req.user
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
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

    // Extract token from "Bearer <token>" format
    const authHeader = req.headers.authorization;
    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        success: false,
        msg: "Unauthorized: Invalid token format",
      });
    }

    const token = parts[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        msg: "Unauthorized: Token is required",
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_PRIVATE_KEY);
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          msg: "Unauthorized: Token has expired",
        });
      } else if (jwtError.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          msg: "Unauthorized: Invalid token",
        });
      } else {
        return res.status(401).json({
          success: false,
          msg: "Unauthorized: Token verification failed",
        });
      }
    }

    // Check token expiration (30 days from issue time)
    const today = new Date();
    const tokenIssueDate = new Date(decoded.iat * 1000); // Convert to milliseconds
    const expirationDate = new Date(tokenIssueDate);
    expirationDate.setDate(expirationDate.getDate() + 30);

    if (today > expirationDate) {
      return res.status(401).json({
        success: false,
        msg: "Unauthorized: Token has expired",
      });
    }

    // Verify user exists and is active
    const user = await UserModel.findOne({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        msg: "Unauthorized: User not found",
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        msg: "Unauthorized: User account is inactive",
      });
    }

    // Attach user to request object
    req.user = user;

    next();
  } catch (error) {
    console.error("JWT verification error:", error);
    return res.status(401).json({
      success: false,
      msg: "Unauthorized: Authentication failed",
      error: error.message,
    });
  }
};
