const admin = require("firebase-admin");

// You can either:
// 1) Use GOOGLE_APPLICATION_CREDENTIALS pointing to a service account JSON file, or
// 2) Provide service account values via env (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)

let app;

if (!admin.apps.length) {
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    // Initialize with explicit service account from environment variables
    const credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Replace escaped newlines in private key
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });

    app = admin.initializeApp({
      credential,
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  } else {
    // Fallback: rely on GOOGLE_APPLICATION_CREDENTIALS or default credentials
    app = admin.initializeApp({
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }
} else {
  app = admin.app();
}

const db = admin.database();

module.exports = {
  admin,
  app,
  db,
};


