const User = require("../models/user");
const Stack = require("../models/stack");
const Notebook = require("../models/notebook");
const Tag = require("../models/tag");
const Note = require("../models/note");
const NoteTag = require("../models/noteTag");
const File = require("../models/file");
const Task = require("../models/task");
const UserSetting = require("../models/userSetting");
const Color = require("../models/color");
const Template = require("../models/template");
const NoteShare = require("../models/noteShare");
const ExternalEvent = require("../models/externalEvent");
const MindMap = require("../models/mindmap");
const ScratchPad = require("../models/scratchPad");
const NoteComment = require("../models/noteComment");
const Notification = require("../models/notification");
const ClipperOtp = require("../models/clipperOtp");
const StudySession = require("../models/studySession");
const preData = require("../config/preData.json");

// Minimal helper to bulk insert while ignoring duplicates
const seed = async (Model, rows) => {
  if (!rows || !rows.length) return;
  await Model.bulkCreate(rows, { ignoreDuplicates: true });
};

const initiatePreData = async () => {
  try {
    // //Syncing and creating tables if not created
    await Color.sync();
    await User.sync();
    await Stack.sync();
    await Notebook.sync();
    await Tag.sync();
    await Note.sync();
    await NoteTag.sync();
    await File.sync();
    // Task gets alter:true once so the new tasks.user_id column gets added
    // to existing databases without dropping data, then back-fill from the
    // related note's user_id below.
    await Task.sync({ alter: true });
    try {
      await Task.sequelize.query(
        "UPDATE tasks t LEFT JOIN notes n ON n.id = t.note_id SET t.user_id = n.user_id WHERE t.user_id IS NULL AND t.note_id IS NOT NULL"
      );
    } catch (err) {
      console.error("tasks.user_id backfill skipped:", err.message || err);
    }
    await UserSetting.sync();
    await Template.sync();
    await NoteShare.sync();
    // alter:true once so the new external_events.note_id column is added to
    // existing databases without dropping data.
    await ExternalEvent.sync({ alter: true });
    // alter:true once so the new mindmaps.layout_type column is added to
    // existing databases without dropping data.
    await MindMap.sync({ alter: true });
    await ScratchPad.sync();
    await NoteComment.sync();
    await Notification.sync();
    await ClipperOtp.sync();
    // StudySession depends on MindMap, so sync after MindMap above.
    await StudySession.sync();
    //Checking existing Event Types table data

    //Checking existing Colors table data
    let colors = await Color.findAll();
    if (colors.length == 0) {
      try {
        await Color.bulkCreate(preData.colors);
      } catch (err) {
        console.error("Error in Color model:", err.message || err);
      }
    }

    //Checking existing Users table data
    let users = await User.findAll();
    if (users.length == 0) {
      try {
        await User.bulkCreate(preData.users);
      } catch (err) {
        console.error("Error in User model:", err.message || err);
      }
    }

    //Checking existing Stacks table data
    let stacks = await Stack.findAll();
    if (stacks.length == 0) {
      try {
        await Stack.bulkCreate(preData.stacks);
      } catch (err) {
        console.error("Error in Stack model:", err.message || err);
      }
    }
    //Checking existing Notebooks table data
    let notebooks = await Notebook.findAll();
    if (notebooks.length == 0) {
      try {
        await Notebook.bulkCreate(preData.notebooks);
      } catch (err) {
        console.error("Error in Notebook model:", err.message || err);
      }
    }

    //Checking existing Tags table data
    let tags = await Tag.findAll();
    if (tags.length == 0) {
      try {
        await Tag.bulkCreate(preData.tags);
      } catch (err) {
        console.error("Error in Tag model:", err.message || err);
      }
    }

    //Checking existing Notes table data
    let notes = await Note.findAll();
    if (notes.length == 0) {
      try {
        await Note.bulkCreate(preData.notes);
      } catch (err) {
        console.error("Error in Note model:", err.message || err);
      }
    }

    //Checking existing NoteTags table data
    let noteTags = await NoteTag.findAll();
    if (noteTags.length == 0) {
      try {
        await NoteTag.bulkCreate(preData.note_tags);
      } catch (err) {
        console.error("Error in NoteTag model:", err.message || err);
      }
    }

    //Checking existing Files table data
    let files = await File.findAll();
    if (files.length == 0) {
      try {
        await File.bulkCreate(preData.files);
      } catch (err) {
        console.error("Error in File model:", err.message || err);
      }
    }

    //Checking existing Tasks table data
    let tasks = await Task.findAll();
    if (tasks.length == 0) {
      try {
        await Task.bulkCreate(preData.tasks);
      } catch (err) {
        console.error("Error in Task model:", err.message || err);
      }
    }

    //Checking existing UserSettings table data
    let userSettings = await UserSetting.findAll();
    if (userSettings.length == 0) {
      try {
        await UserSetting.bulkCreate(preData.user_settings);
      } catch (err) {
        console.error("Error in UserSetting model:", err.message || err);
      }
    }

    //Checking existing Templates table data
    let templates = await Template.findAll();
    if (templates.length == 0) {
      try {
        await Template.bulkCreate(preData.templates);
      } catch (err) {
        console.error("Error in Template model:", err.message || err);
      }
    }
    console.info("PreData syncing completed");
  } catch (err) {
    console.error("Error while syncing PreData:", err.message || err);
    if (err.errors) {
      err.errors.forEach((error) => {
        console.error(`  - ${error.path}: ${error.message}`);
      });
    }
  }
};

module.exports = initiatePreData;

