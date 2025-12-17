// helpers/noteFirestoreHelper.js  (or keep name as noteFirebaseHelper.js if preferred)

const admin = require("firebase-admin");
const { db } = require("../config/firebase"); // db is now Firestore instance

const notesCollection = db.collection("notes");

/**
 * Initialize a new note document in Firestore with a known UUID
 * @param {string} firebaseDocId - UUID (v4)
 * @param {Object} initialData - Optional initial data
 */
const initializeNoteContent = async (firebaseDocId, initialData = {}) => {
  try {
    if (!firebaseDocId || typeof firebaseDocId !== "string") {
      throw new Error("Valid firebaseDocId (UUID) is required");
    }

    const defaultData = {
      title: "Untitled Note",
      content: "", // Rich text, HTML, or JSON blocks
      user_id: null,
      notebook_id: null,
      is_trashed: false,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      ...initialData,
    };

    await notesCollection.doc(firebaseDocId).set(defaultData);
  } catch (error) {
    console.error(`Error initializing note ${firebaseDocId}:`, error);
    throw new Error(`Failed to initialize note content: ${error.message}`);
  }
};

/**
 * Get note content from Firestore
 */
const getNoteContent = async (firebaseDocId) => {
  try {
    if (!firebaseDocId || typeof firebaseDocId !== "string") {
      throw new Error("Valid firebaseDocId is required");
    }

    const doc = await notesCollection.doc(firebaseDocId).get();

    if (!doc.exists) {
      return null;
    }

    return doc.data(); // ← Fixed: .data() instead of .val()
  } catch (error) {
    console.error(`Error fetching note ${firebaseDocId}:`, error);
    throw new Error(`Failed to get note content: ${error.message}`);
  }
};

/**
 * Save/update note content (partial update)
 */
const saveNoteContent = async (firebaseDocId, data) => {
  try {
    if (!firebaseDocId || typeof firebaseDocId !== "string") {
      throw new Error("Valid firebaseDocId is required");
    }
    if (!data || typeof data !== "object") {
      throw new Error("Data must be a valid object");
    }

    await notesCollection.doc(firebaseDocId).update({
      ...data,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error(`Error saving note ${firebaseDocId}:`, error);
    throw new Error(`Failed to save note content: ${error.message}`);
  }
};

/**
 * Delete note from Firestore
 */
const deleteNoteContent = async (firebaseDocId) => {
  try {
    if (!firebaseDocId || typeof firebaseDocId !== "string") {
      throw new Error("Valid firebaseDocId is required");
    }

    await notesCollection.doc(firebaseDocId).delete();
  } catch (error) {
    console.error(`Error deleting note ${firebaseDocId}:`, error);
    throw new Error(`Failed to delete note content: ${error.message}`);
  }
};

module.exports = {
  initializeNoteContent,
  getNoteContent,
  saveNoteContent,
  deleteNoteContent,
};