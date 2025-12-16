const router = require("express").Router();
const jwtVerify = require("../config/jwtVerify");

const {
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
  deleteAccount
} = require("../controllers/UserController");

// ==============================
// Auth (Public Routes)
// ==============================
router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// ==============================
// Auth (Protected Routes)
// ==============================
router.post("/logout", jwtVerify, logout);
router.post("/refresh-token", jwtVerify, refreshToken);

// ==============================
// Profile (Protected)
// ==============================
router.get("/me", jwtVerify, getProfile);
router.put("/me", jwtVerify, updateProfile);

// ==============================
// Security (Protected)
// ==============================
router.put("/change-password", jwtVerify, changePassword);

// ==============================
// User Settings (Protected)
// ==============================
router.get("/settings", jwtVerify, getUserSettings);
router.put("/settings", jwtVerify, updateUserSettings);

// ==============================
// Account (Protected)
// ==============================
router.delete("/delete-account", jwtVerify, deleteAccount);

module.exports = router;
