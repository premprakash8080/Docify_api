const router = require("express").Router();
const jwtVerify = require("../config/jwtVerify");
const searchController = require("../controllers/SearchController");

const { globalSearch } = searchController;

// Apply JWT middleware to all routes
router.use(jwtVerify);

// ==============================
// Search APIs
// ==============================

// Global search across all entity types
// Query params: ?query=search_term&types=note&types=notebook&filters=notebook_id
router.get("/global", globalSearch);

module.exports = router;

