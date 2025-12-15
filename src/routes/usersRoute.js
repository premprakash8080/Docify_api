const router = require("express").Router();

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
// Auth
// ==============================
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh-token", refreshToken);

// ==============================
// Password Recovery
// ==============================
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// ==============================
// Profile
// ==============================
router.get("/me", getProfile);
router.put("/me", updateProfile);

// ==============================
// Security
// ==============================
router.put("/change-password", changePassword);

// ==============================
// User Settings
// ==============================
router.get("/settings", getUserSettings);
router.put("/settings", updateUserSettings);

// ==============================
// Account
// ==============================
router.delete("/delete-account", deleteAccount);

module.exports = router;
