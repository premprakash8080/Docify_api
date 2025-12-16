const User = require("./user");
const Stack = require("./stack");
const Notebook = require("./notebook");
const Note = require("./note");
const Tag = require("./tag");
const File = require("./file");
const Task = require("./task");
const NoteTag = require("./noteTag");
const Color = require("./color");
const UserSetting = require("./userSetting");
const Template = require("./template");

// Centralized model associations for Evernote-style project

// User relationships
User.hasMany(Stack, { foreignKey: "user_id", as: "stacks" });
User.hasMany(Notebook, { foreignKey: "user_id", as: "notebooks" });
User.hasMany(Tag, { foreignKey: "user_id", as: "tags" });
User.hasMany(Note, { foreignKey: "user_id", as: "notes" });
User.hasMany(File, { foreignKey: "user_id", as: "files" });
User.hasMany(Template, { foreignKey: "user_id", as: "templates" });
// Each user has a single settings row
User.hasOne(UserSetting, { foreignKey: "user_id", as: "settings" });
UserSetting.belongsTo(User, { foreignKey: "user_id", as: "user" });

// Stack relationships
Stack.hasMany(Notebook, { foreignKey: "stack_id", as: "notebooks" });
Stack.belongsTo(Color, { foreignKey: "color_id", as: "color" });

// Notebook relationships
Notebook.hasMany(Note, { foreignKey: "notebook_id", as: "notes" });
Notebook.belongsTo(Color, { foreignKey: "color_id", as: "color" });
Notebook.belongsTo(Stack, { foreignKey: "stack_id", as: "stack" });

// Note relationships
Note.hasMany(Task, { foreignKey: "note_id", as: "tasks" });
Note.hasMany(File, { foreignKey: "note_id", as: "files" });
Note.belongsTo(Notebook, { foreignKey: "notebook_id", as: "notebook" });
Note.belongsTo(User, { foreignKey: "user_id", as: "user" });
Note.belongsToMany(Tag, { through: NoteTag, foreignKey: "note_id", otherKey: "tag_id", as: "tags" });

// Tag relationships
Tag.belongsTo(Color, { foreignKey: "color_id", as: "color" });

// File relationships
File.belongsTo(Note, { foreignKey: "note_id", as: "note" });

// Task relationships
Task.belongsTo(Note, { foreignKey: "note_id", as: "note" });

module.exports = {
  User,
  Stack,
  Notebook,
  Note,
  Tag,
  File,
  Task,
  NoteTag,
  Color,
  UserSetting,
  Template,
};


