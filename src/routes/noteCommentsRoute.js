const router = require("express").Router();
const jwtVerify = require("../config/jwtVerify");
const {
  list,
  create,
  update,
  remove,
} = require("../controllers/NoteCommentController");

router.use(jwtVerify);

router.get("/", list);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

module.exports = router;
