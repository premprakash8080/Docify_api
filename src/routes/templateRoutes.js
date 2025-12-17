const router = require("express").Router();
const jwtVerify = require("../config/jwtVerify");

const {
    getAllTemplates,
    getSystemTemplates,
    getUserTemplates,
    getTemplateById,
    createTemplate,
    cloneTemplate,
    deleteTemplate,
} = require("../controllers/TemplateController");

// Apply JWT middleware to all routes
router.use(jwtVerify);

// ==============================
// Template Views (Read)
// ==============================

// Get all templates (system + user)
router.get("/getAllTemplates", getAllTemplates);

// Prebuilt / System templates (for system tab)
router.get("/getSystemTemplates", getSystemTemplates);

// My templates (user-created)
router.get("/getMyTemplates", getUserTemplates);

// Single template by id
router.get("/getTemplateById", getTemplateById);

// ==============================
// Template Actions (Write)
// ==============================

// Create a new user template
router.post("/createTemplate", createTemplate);

// Clone system/user template → create user note/template
router.post("/cloneTemplate", cloneTemplate);

// Delete user template
router.delete("/deleteTemplate/:id", deleteTemplate);

module.exports = router;
