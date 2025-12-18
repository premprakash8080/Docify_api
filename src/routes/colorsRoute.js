const router = require("express").Router();
const jwtVerify = require("../config/jwtVerify");
const colorsController = require("../controllers/colorsController");

const {
    getAllColors,
    getColorById,
    createColor,
    updateColor,
    deleteColor,
  } = colorsController();


// Apply JWT middleware to all routes
router.use(jwtVerify);

// ==============================
// Colors CRUD
// ==============================
router.get("/", getAllColors);
router.get("/:id", getColorById);

router.post("/", createColor);
router.put("/:id", updateColor);
router.delete("/:id", deleteColor);


module.exports = router;