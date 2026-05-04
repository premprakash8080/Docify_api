const router = require("express").Router();
const jwtVerify = require("../config/jwtVerify");
const {
  getAllMindMaps,
  getMindMapById,
  createMindMap,
  updateMindMap,
  deleteMindMap,
} = require("../controllers/MindMapController");

router.use(jwtVerify);

router.get("/", getAllMindMaps);
router.post("/", createMindMap);
router.get("/:id", getMindMapById);
router.put("/:id", updateMindMap);
router.delete("/:id", deleteMindMap);

module.exports = router;
