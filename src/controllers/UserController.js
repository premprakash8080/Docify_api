const User = require("../models/user");
const UserSetting = require("../models/userSetting");
const { issueJWT } = require("../utils/issueJWT");
const { admin } = require("../config/firebase");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const UserController = () => {
  /**
   * @description Register a new user with email/password
   * @param req.body.email - User email
   * @param req.body.password - User password
   * @param req.body.display_name - User display name (optional)
   * @returns created user and JWT token
   */
  const register = async (req, res) => {
    try {
      const { email, password, display_name } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          msg: "Email and password are required",
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          msg: "User with this email already exists",
        });
      }

      // Hash password for MySQL storage
      const password_hash = await bcrypt.hash(password, 10);

      // Generate a unique identifier for email/password users
      // Note: This is not a Firebase UID since Firebase Auth is not configured
      // For email/password auth, we use local authentication with JWT
      const localUid = `email_${crypto.randomUUID()}`;

      // Create user in MySQL
      const user = await User.create({
        firebase_uid: localUid,
        email,
        display_name: display_name || null,
        auth_provider: "email",
        password_hash,
        is_active: true,
      });

      // Issue JWT token
      const tokenData = issueJWT(user.id, null);

      return res.status(201).json({
        success: true,
        msg: "User registered successfully",
        data: {
          user: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            auth_provider: user.auth_provider,
          },
          token: tokenData.token,
          expires: tokenData.expires,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error during registration",
        error: error.message,
      });
    }
  };

  /**
   * @description Login user with email/password
   * @param req.body.email - User email
   * @param req.body.password - User password
   * @returns user data and JWT token
   */
  const login = async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          msg: "Email and password are required",
        });
      }

      // Find user in MySQL
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(401).json({
          success: false,
          msg: "Invalid email or password",
        });
      }

      // Check if user is active
      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          msg: "Account is deactivated",
        });
      }

      // Verify password
      if (user.auth_provider === "email" && user.password_hash) {
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
          return res.status(401).json({
            success: false,
            msg: "Invalid email or password",
          });
        }
      } else {
        // For Google users, they should use Firebase Auth directly
        return res.status(400).json({
          success: false,
          msg: "Please use Google sign-in for this account",
        });
      }

      // For email/password users, skip Firebase Auth verification
      // Firebase Auth is only used for Google OAuth users
      if (user.auth_provider === "google") {
        try {
          await admin.auth().getUser(user.firebase_uid);
        } catch (firebaseError) {
          return res.status(401).json({
            success: false,
            msg: "Firebase user not found",
          });
        }
      }

      // Update last login
      await user.update({ last_login_at: new Date() });

      // Issue JWT token
      const tokenData = issueJWT(user.id, null);

      return res.status(200).json({
        success: true,
        msg: "Login successful",
        data: {
          user: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            auth_provider: user.auth_provider,
          },
          token: tokenData.token,
          expires: tokenData.expires,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error during login",
        error: error.message,
      });
    }
  };

  /**
   * @description Logout user (client-side token removal, server can track if needed)
   * @param req.user - User from JWT middleware
   * @returns success message
   */
  const logout = async (req, res) => {
    try {
      // In a stateless JWT system, logout is handled client-side
      // Optionally, you can track logout events or invalidate tokens
      return res.status(200).json({
        success: true,
        msg: "Logout successful",
      });
    } catch (error) {
      console.error("Logout error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error during logout",
        error: error.message,
      });
    }
  };

  /**
   * @description Refresh JWT token
   * @param req.user - User from JWT middleware
   * @returns new JWT token
   */
  const refreshToken = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      // Issue new JWT token
      const tokenData = issueJWT(req.user.id, null);

      return res.status(200).json({
        success: true,
        msg: "Token refreshed successfully",
        data: {
          token: tokenData.token,
          expires: tokenData.expires,
        },
      });
    } catch (error) {
      console.error("Refresh token error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error during token refresh",
        error: error.message,
      });
    }
  };

  /**
   * @description Send password reset email via Firebase
   * @param req.body.email - User email
   * @returns success message
   */
  const forgotPassword = async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          msg: "Email is required",
        });
      }

      // Find user in MySQL
      const user = await User.findOne({ where: { email } });
      if (!user) {
        // Don't reveal if user exists for security
        return res.status(200).json({
          success: true,
          msg: "If an account exists with this email, a password reset link has been sent",
        });
      }

      // Check if user uses email/password auth
      if (user.auth_provider !== "email") {
        return res.status(400).json({
          success: false,
          msg: "This account uses Google sign-in. Password reset is not available.",
        });
      }

      // Generate password reset link via Firebase
      try {
        const resetLink = await admin.auth().generatePasswordResetLink(email);
        // In production, send email with resetLink
        // For now, return success (email sending should be handled separately)
        return res.status(200).json({
          success: true,
          msg: "Password reset link sent to email",
          // Remove resetLink in production, only include for development
          ...(process.env.NODE_ENV !== "production" && { resetLink }),
        });
      } catch (firebaseError) {
        console.error("Firebase password reset error:", firebaseError);
        return res.status(400).json({
          success: false,
          msg: "Failed to generate password reset link",
          error: firebaseError.message,
        });
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Reset password using Firebase oobCode
   * @param req.body.oobCode - Firebase password reset code
   * @param req.body.newPassword - New password
   * @returns success message
   */
  const resetPassword = async (req, res) => {
    try {
      const { oobCode, newPassword } = req.body;

      if (!oobCode || !newPassword) {
        return res.status(400).json({
          success: false,
          msg: "Reset code and new password are required",
        });
      }

      // Verify the reset code and get email
      let email;
      try {
        // Firebase Admin SDK doesn't have direct oobCode verification
        // This should be handled client-side with Firebase Auth
        // For backend, we'll need to verify the token differently
        return res.status(400).json({
          success: false,
          msg: "Password reset should be handled client-side with Firebase Auth",
        });
      } catch (error) {
        return res.status(400).json({
          success: false,
          msg: "Invalid or expired reset code",
        });
      }
    } catch (error) {
      console.error("Reset password error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get current user profile
   * @param req.user - User from JWT/Firebase middleware
   * @returns user profile data
   */
  const getProfile = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const user = await User.findByPk(req.user.id, {
        attributes: { exclude: ["password_hash"] },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          msg: "User not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            auth_provider: user.auth_provider,
            is_active: user.is_active,
            created_at: user.created_at,
            last_login_at: user.last_login_at,
          },
        },
      });
    } catch (error) {
      console.error("Get profile error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Update user profile
   * @param req.user - User from JWT/Firebase middleware
   * @param req.body.display_name - New display name (optional)
   * @param req.body.avatar_url - New avatar URL (optional)
   * @returns updated user profile
   */
  const updateProfile = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { display_name, avatar_url } = req.body;
      const user = await User.findByPk(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          msg: "User not found",
        });
      }

      // Update allowed fields
      if (display_name !== undefined) user.display_name = display_name;
      if (avatar_url !== undefined) user.avatar_url = avatar_url;

      await user.save();

      // Update Firebase Auth if display name changed (only for Google users)
      if (display_name !== undefined && user.auth_provider === "google") {
        try {
          await admin.auth().updateUser(user.firebase_uid, {
            displayName: display_name,
          });
        } catch (firebaseError) {
          console.error("Firebase update error:", firebaseError);
          // Continue even if Firebase update fails
        }
      }

      return res.status(200).json({
        success: true,
        msg: "Profile updated successfully",
        data: {
          user: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            auth_provider: user.auth_provider,
          },
        },
      });
    } catch (error) {
      console.error("Update profile error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Change user password
   * @param req.user - User from JWT/Firebase middleware
   * @param req.body.currentPassword - Current password
   * @param req.body.newPassword - New password
   * @returns success message
   */
  const changePassword = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          msg: "Current password and new password are required",
        });
      }

      const user = await User.findByPk(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          msg: "User not found",
        });
      }

      // Check if user uses email/password auth
      if (user.auth_provider !== "email" || !user.password_hash) {
        return res.status(400).json({
          success: false,
          msg: "Password change is only available for email/password accounts",
        });
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password_hash
      );
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          msg: "Current password is incorrect",
        });
      }

      // Update password in Firebase (only for Google users)
      // For email/password users, we only update MySQL
      if (user.auth_provider === "google") {
        try {
          await admin.auth().updateUser(user.firebase_uid, {
            password: newPassword,
          });
        } catch (firebaseError) {
          console.error("Firebase password update error:", firebaseError);
          return res.status(400).json({
            success: false,
            msg: "Failed to update password in Firebase",
            error: firebaseError.message,
          });
        }
      }

      // Hash and update password in MySQL
      const password_hash = await bcrypt.hash(newPassword, 10);
      await user.update({ password_hash });

      return res.status(200).json({
        success: true,
        msg: "Password changed successfully",
      });
    } catch (error) {
      console.error("Change password error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Get user settings
   * @param req.user - User from JWT/Firebase middleware
   * @returns user settings object
   */
  const getUserSettings = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      // Fetch or create a single settings row for the user
      const [settings] = await UserSetting.findOrCreate({
        where: { user_id: req.user.id },
        defaults: {
          theme_layout: "default",
          theme_color: "light",
          corners: "rounded",
          button_style: "solid",
        },
      });

      // Convert settings row to object expected by frontend
      const settingsObject = {
        theme_layout: settings.theme_layout,
        theme_color: settings.theme_color,
        corners: settings.corners,
        button_style: settings.button_style,
      };

      return res.status(200).json({
        success: true,
        data: {
          settings: settingsObject,
        },
      });
    } catch (error) {
      console.error("Get user settings error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Update user settings
   * @param req.user - User from JWT/Firebase middleware
   * @param req.body.settings - Object with settings fields
   * @returns updated settings
   */
  const updateUserSettings = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { settings } = req.body;

      if (!settings || typeof settings !== "object") {
        return res.status(400).json({
          success: false,
          msg: "Settings object is required",
        });
      }

      // Allowed settings fields for the single settings row
      const allowedKeys = [
        "theme_layout",
        "theme_color",
        "corners",
        "button_style",
      ];

      // Build update payload from allowed keys only
      const updatePayload = {};
      for (const key of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(settings, key)) {
          updatePayload[key] = settings[key];
        }
      }

      // Find or create the settings row for this user
      const [userSettings] = await UserSetting.findOrCreate({
        where: { user_id: req.user.id },
        defaults: {
          theme_layout: "default",
          theme_color: "light",
          corners: "rounded",
          button_style: "solid",
        },
      });

      // Apply updates if there are any allowed keys
      if (Object.keys(updatePayload).length > 0) {
        await userSettings.update(updatePayload);
      }

      const updatedSettings = {
        theme_layout: userSettings.theme_layout,
        theme_color: userSettings.theme_color,
        corners: userSettings.corners,
        button_style: userSettings.button_style,
      };

      return res.status(200).json({
        success: true,
        msg: "Settings updated successfully",
        data: {
          settings: updatedSettings,
        },
      });
    } catch (error) {
      console.error("Update user settings error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Delete user account (soft delete by deactivating)
   * @param req.user - User from JWT/Firebase middleware
   * @param req.body.password - Password confirmation (for email/password users)
   * @returns success message
   */
  const deleteAccount = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const user = await User.findByPk(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          msg: "User not found",
        });
      }

      // For email/password users, verify password
      if (user.auth_provider === "email" && user.password_hash) {
        const { password } = req.body;
        if (!password) {
          return res.status(400).json({
            success: false,
            msg: "Password confirmation is required",
          });
        }

        const isPasswordValid = await bcrypt.compare(
          password,
          user.password_hash
        );
        if (!isPasswordValid) {
          return res.status(401).json({
            success: false,
            msg: "Password is incorrect",
          });
        }
      }

      // Deactivate user in MySQL
      await user.update({ is_active: false });

      // Optionally disable user in Firebase (only for Google users)
      // For email/password users, we only update MySQL
      if (user.auth_provider === "google") {
        try {
          await admin.auth().updateUser(user.firebase_uid, {
            disabled: true,
          });
        } catch (firebaseError) {
          console.error("Firebase disable error:", firebaseError);
          // Continue even if Firebase update fails
        }
      }

      return res.status(200).json({
        success: true,
        msg: "Account deleted successfully",
      });
    } catch (error) {
      console.error("Delete account error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  return {
    register,
    login,
    logout,
    refreshToken,
    forgotPassword,
    resetPassword,
    getProfile,
    updateProfile,
    changePassword,
    getUserSettings,
    updateUserSettings,
    deleteAccount,
  };
};

module.exports = UserController();
