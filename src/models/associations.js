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
const ScratchPad = require("./scratchPad");
const ExternalEvent = require("./externalEvent");
const NoteShare = require("./noteShare");
const MindMap = require("./mindmap");
const StudySession = require("./studySession");
const Notification = require("./notification");
const NoteComment = require("./noteComment");
const ClipperOtp = require("./clipperOtp");

// Centralized model associations for Evernote-style project

// User relationships
User.hasMany(Stack, { foreignKey: "user_id", as: "stacks" });
User.hasMany(Notebook, { foreignKey: "user_id", as: "notebooks" });
User.hasMany(Tag, { foreignKey: "user_id", as: "tags" });
User.hasMany(Note, { foreignKey: "user_id", as: "notes" });
User.hasMany(File, { foreignKey: "user_id", as: "files" });
User.hasMany(Template, { foreignKey: "user_id", as: "templates" });
User.hasMany(ExternalEvent, { foreignKey: "user_id", as: "externalEvents" });
// Each user has a single settings row
User.hasOne(UserSetting, { foreignKey: "user_id", as: "settings" });
UserSetting.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(Notification, { foreignKey: "user_id", as: "notifications" });
Notification.belongsTo(User, { foreignKey: "user_id", as: "user" });

// Note comments — every comment belongs to a note + a user; threaded via parent_id.
NoteComment.belongsTo(User, { foreignKey: "user_id", as: "author" });
User.hasMany(NoteComment, { foreignKey: "user_id", as: "noteComments" });
NoteComment.belongsTo(NoteComment, { foreignKey: "parent_id", as: "parent" });
NoteComment.hasMany(NoteComment, { foreignKey: "parent_id", as: "replies" });
// Each user has a single scratch pad
User.hasOne(ScratchPad, { foreignKey: "user_id", as: "scratchPad" });
ScratchPad.belongsTo(User, { foreignKey: "user_id", as: "user" });

// Stack relationships
Stack.hasMany(Notebook, { foreignKey: "stack_id", as: "notebooks" });
Stack.belongsTo(Color, { foreignKey: "color_id", as: "color" });

// Notebook relationships
Notebook.hasMany(Note, { foreignKey: "notebook_id", as: "notes" });
Notebook.belongsTo(Color, { foreignKey: "color_id", as: "color" });
Notebook.belongsTo(Stack, { foreignKey: "stack_id", as: "stack" });

// Note relationships
Note.hasMany(Task, { foreignKey: "note_id", as: "tasks" });
Note.hasMany(NoteComment, { foreignKey: "note_id", as: "comments" });
NoteComment.belongsTo(Note, { foreignKey: "note_id", as: "note" });
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
Task.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(Task, { foreignKey: "user_id", as: "tasks" });

// ExternalEvent relationships
ExternalEvent.belongsTo(User, { foreignKey: "user_id", as: "user" });

// NoteShare relationships
Note.hasMany(NoteShare, { foreignKey: "note_id", as: "shares" });
NoteShare.belongsTo(Note, { foreignKey: "note_id", as: "note" });
NoteShare.belongsTo(User, { foreignKey: "owner_id", as: "owner" });
NoteShare.belongsTo(User, { foreignKey: "shared_with_user_id", as: "sharedWith" });
User.hasMany(NoteShare, { foreignKey: "shared_with_user_id", as: "sharedNotes" });

// MindMap relationships
MindMap.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(MindMap, { foreignKey: "user_id", as: "mindmaps" });

// StudySession relationships
StudySession.belongsTo(User, { foreignKey: "user_id", as: "user" });
StudySession.belongsTo(Note, { foreignKey: "note_id", as: "note" });
StudySession.belongsTo(MindMap, { foreignKey: "mind_map_id", as: "mindMap" });
User.hasMany(StudySession, { foreignKey: "user_id", as: "studySessions" });
Note.hasMany(StudySession, { foreignKey: "note_id", as: "studySessions" });
MindMap.hasMany(StudySession, { foreignKey: "mind_map_id", as: "studySessions" });

// ClipperOtp — short-lived one-time codes used by the Web Clipper
// extension's OAuth-style sign-in flow.
ClipperOtp.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(ClipperOtp, { foreignKey: "user_id", as: "clipperOtps" });

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
  ScratchPad,
  ExternalEvent,
  NoteShare,
  MindMap,
  StudySession,
  ClipperOtp,
};


