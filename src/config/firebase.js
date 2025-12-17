// config/firebase.js

const admin = require("firebase-admin");

if (!admin.apps.length) {
  try {
    let credential;

    if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      });
    } else {
      credential = admin.credential.applicationDefault();
    }

    admin.initializeApp({
      credential,
      // No databaseURL needed for Firestore
    });

    console.info("Firebase Admin (Firestore) initialized successfully");
  } catch (error) {
    console.error("Firebase initialization error:", error);
    throw new Error("Failed to initialize Firebase Admin SDK");
  }
}

// Export Firestore instance
const db = admin.firestore();

module.exports = {
  admin,
  app: admin.app(),
  db, // This is now Firestore, not Realtime Database
};