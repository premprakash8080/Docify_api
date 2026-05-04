const router = require("express").Router();
const jwtVerify = require("../config/jwtVerify");
const { editor, providers } = require("../controllers/AIController");

router.use(jwtVerify);

// Run an AI action against selected/full note text.
router.post("/editor", editor);

// List configured AI providers (so the UI can show a model selector).
router.get("/providers", providers);

module.exports = router;
