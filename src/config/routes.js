/**
 * Import Route files and set in express middleware
 */

exports.set_routes = (app) => {
  const users = require("../routes/usersRoute");
  const notes = require("../routes/notesRoutes");
  const notebooks = require("../routes/notebooksRoutes");
  const stacks = require("../routes/stacksRoute");
  const tags = require("../routes/tagsRoute");
  const files = require("../routes/filesRoutes");
  const tasks = require("../routes/tasksRoutes");
  const calendar = require("../routes/calendarRoutes");
  const templates = require("../routes/templateRoutes");

  app.use("/api/users", users);
  app.use("/api/notes", notes);
  app.use("/api/notebooks", notebooks);
  app.use("/api/stacks", stacks);
  app.use("/api/tags", tags);
  app.use("/api/files", files);
  app.use("/api/tasks", tasks);
  app.use("/api/calendar", calendar);
  app.use("/api/templates", templates);
};
