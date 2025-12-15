/**
 * Import Route files and set in express middleware
 */

exports.set_routes = (app) => {
  const users = require("../routes/usersRoute");
  const notes = require("../routes/notesRoutes");
  const notebooks = require("../routes/notebooksRoutes");
  const stacks = require("../routes/stacksRoute");
  const tags = require("../routes/tags");

  app.use("/api/users", users);
  app.use("/api/notes", notes);
  app.use("/api/notebooks", notebooks);
  app.use("/api/stacks", stacks);
  app.use("/api/tags", tags);

};
