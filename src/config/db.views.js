const database = require('./database');

async function syncViews() {
  try {
    // Drop existing views first to avoid conflicts
    await dropViews();

    console.info('Database views synced successfully (no views configured)');
  } catch (err) {
    console.error('Error syncing database views:', err.message || err);
    throw err;
  }
}

async function dropViews() {
  try {
    // Drop all views that were previously used
    await database.query(`DROP VIEW IF EXISTS note_list_view`);
  } catch (err) {
    console.error('Error dropping views:', err.message || err);
    // Don't throw - views might not exist yet
  }
}

module.exports = {
  syncViews,
  dropViews
};

