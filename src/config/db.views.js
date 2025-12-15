const database = require('./database');

async function syncViews() {
  try {
    // Drop existing views first to avoid conflicts
    await dropViews();

    // NOTE LIST VIEW - Comprehensive note information with related data
    await database.query(`
      CREATE OR REPLACE VIEW note_list_view AS
      SELECT 
        n.id,
        n.user_id,
        n.notebook_id,
        n.firebase_document_id,
        n.title,
        n.pinned,
        n.archived,
        n.trashed,
        n.version,
        n.synced,
        n.created_at,
        n.updated_at,
        n.last_modified,
        -- Notebook information
        nb.name AS notebook_name,
        nb.description AS notebook_description,
        nb.color_id AS notebook_color_id,
        c_nb.hex_code AS notebook_color_hex,
        c_nb.name AS notebook_color_name,
        -- Stack information
        s.id AS stack_id,
        s.name AS stack_name,
        s.description AS stack_description,
        s.color_id AS stack_color_id,
        c_s.hex_code AS stack_color_hex,
        c_s.name AS stack_color_name,
        -- User information
        u.email AS user_email,
        u.display_name AS user_display_name,
        -- Aggregated counts
        COALESCE(tag_counts.tag_count, 0) AS tag_count,
        COALESCE(file_counts.file_count, 0) AS file_count,
        COALESCE(task_counts.task_count, 0) AS task_count,
        COALESCE(task_counts.completed_task_count, 0) AS completed_task_count
      FROM notes n
      LEFT JOIN notebooks nb ON n.notebook_id = nb.id
      LEFT JOIN stacks s ON nb.stack_id = s.id
      LEFT JOIN users u ON n.user_id = u.id
      LEFT JOIN colors c_nb ON nb.color_id = c_nb.id
      LEFT JOIN colors c_s ON s.color_id = c_s.id
      LEFT JOIN (
        SELECT note_id, COUNT(*) AS tag_count
        FROM note_tags
        GROUP BY note_id
      ) tag_counts ON n.id = tag_counts.note_id
      LEFT JOIN (
        SELECT note_id, COUNT(*) AS file_count
        FROM files
        WHERE note_id IS NOT NULL
        GROUP BY note_id
      ) file_counts ON n.id = file_counts.note_id
      LEFT JOIN (
        SELECT 
          note_id,
          COUNT(*) AS task_count,
          SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed_task_count
        FROM tasks
        GROUP BY note_id
      ) task_counts ON n.id = task_counts.note_id
    `);

    // NOTE SUMMARY VIEW - Aggregated statistics per note
    await database.query(`
      CREATE OR REPLACE VIEW note_summary_view AS
      SELECT 
        n.id,
        n.user_id,
        n.notebook_id,
        n.title,
        n.pinned,
        n.archived,
        n.trashed,
        n.created_at,
        n.updated_at,
        -- Aggregated statistics
        COALESCE(tag_stats.tag_count, 0) AS tag_count,
        COALESCE(file_stats.file_count, 0) AS file_count,
        COALESCE(file_stats.total_file_size, 0) AS total_file_size,
        COALESCE(task_stats.task_count, 0) AS task_count,
        COALESCE(task_stats.completed_task_count, 0) AS completed_task_count,
        CASE 
          WHEN COALESCE(task_stats.task_count, 0) > 0 
          THEN ROUND((COALESCE(task_stats.completed_task_count, 0) / task_stats.task_count) * 100, 2)
          ELSE 0 
        END AS task_completion_percentage
      FROM notes n
      LEFT JOIN (
        SELECT note_id, COUNT(*) AS tag_count
        FROM note_tags
        GROUP BY note_id
      ) tag_stats ON n.id = tag_stats.note_id
      LEFT JOIN (
        SELECT 
          note_id,
          COUNT(*) AS file_count,
          SUM(size) AS total_file_size
        FROM files
        WHERE note_id IS NOT NULL
        GROUP BY note_id
      ) file_stats ON n.id = file_stats.note_id
      LEFT JOIN (
        SELECT 
          note_id,
          COUNT(*) AS task_count,
          SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed_task_count
        FROM tasks
        GROUP BY note_id
      ) task_stats ON n.id = task_stats.note_id
    `);

    // USER STATS VIEW - User statistics and counts
    await database.query(`
      CREATE OR REPLACE VIEW user_stats_view AS
      SELECT 
        u.id AS user_id,
        u.email,
        u.display_name,
        u.is_active,
        u.created_at AS user_created_at,
        u.last_login_at,
        -- Counts
        COALESCE(note_stats.note_count, 0) AS total_notes,
        COALESCE(note_stats.pinned_notes, 0) AS pinned_notes,
        COALESCE(note_stats.archived_notes, 0) AS archived_notes,
        COALESCE(note_stats.trashed_notes, 0) AS trashed_notes,
        COALESCE(notebook_stats.notebook_count, 0) AS total_notebooks,
        COALESCE(stack_stats.stack_count, 0) AS total_stacks,
        COALESCE(tag_stats.tag_count, 0) AS total_tags,
        COALESCE(file_stats.file_count, 0) AS total_files,
        COALESCE(file_stats.total_file_size, 0) AS total_file_size,
        COALESCE(task_stats.task_count, 0) AS total_tasks,
        COALESCE(task_stats.completed_tasks, 0) AS completed_tasks
      FROM users u
      LEFT JOIN (
        SELECT 
          user_id,
          COUNT(*) AS note_count,
          SUM(CASE WHEN pinned = 1 THEN 1 ELSE 0 END) AS pinned_notes,
          SUM(CASE WHEN archived = 1 THEN 1 ELSE 0 END) AS archived_notes,
          SUM(CASE WHEN trashed = 1 THEN 1 ELSE 0 END) AS trashed_notes
        FROM notes
        GROUP BY user_id
      ) note_stats ON u.id = note_stats.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS notebook_count
        FROM notebooks
        GROUP BY user_id
      ) notebook_stats ON u.id = notebook_stats.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS stack_count
        FROM stacks
        GROUP BY user_id
      ) stack_stats ON u.id = stack_stats.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS tag_count
        FROM tags
        GROUP BY user_id
      ) tag_stats ON u.id = tag_stats.user_id
      LEFT JOIN (
        SELECT 
          user_id,
          COUNT(*) AS file_count,
          SUM(size) AS total_file_size
        FROM files
        GROUP BY user_id
      ) file_stats ON u.id = file_stats.user_id
      LEFT JOIN (
        SELECT 
          n.user_id,
          COUNT(*) AS task_count,
          SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) AS completed_tasks
        FROM tasks t
        INNER JOIN notes n ON t.note_id = n.id
        GROUP BY n.user_id
      ) task_stats ON u.id = task_stats.user_id
    `);

    // NOTEBOOK SUMMARY VIEW - Notebook with note counts and stack information
    await database.query(`
      CREATE OR REPLACE VIEW notebook_summary_view AS
      SELECT 
        nb.id,
        nb.user_id,
        nb.stack_id,
        nb.name,
        nb.description,
        nb.color_id,
        c.hex_code AS color_hex,
        c.name AS color_name,
        nb.sort_order,
        nb.created_at,
        nb.updated_at,
        -- Stack information
        s.name AS stack_name,
        s.description AS stack_description,
        -- Aggregated counts
        COALESCE(note_counts.note_count, 0) AS note_count,
        COALESCE(note_counts.pinned_notes, 0) AS pinned_notes,
        COALESCE(note_counts.archived_notes, 0) AS archived_notes
      FROM notebooks nb
      LEFT JOIN stacks s ON nb.stack_id = s.id
      LEFT JOIN colors c ON nb.color_id = c.id
      LEFT JOIN (
        SELECT 
          notebook_id,
          COUNT(*) AS note_count,
          SUM(CASE WHEN pinned = 1 THEN 1 ELSE 0 END) AS pinned_notes,
          SUM(CASE WHEN archived = 1 THEN 1 ELSE 0 END) AS archived_notes
        FROM notes
        WHERE trashed = 0
        GROUP BY notebook_id
      ) note_counts ON nb.id = note_counts.notebook_id
    `);

    // STACK SUMMARY VIEW - Stack with notebook counts
    await database.query(`
      CREATE OR REPLACE VIEW stack_summary_view AS
      SELECT 
        s.id,
        s.user_id,
        s.name,
        s.description,
        s.color_id,
        c.hex_code AS color_hex,
        c.name AS color_name,
        s.sort_order,
        s.created_at,
        s.updated_at,
        -- Aggregated counts
        COALESCE(notebook_counts.notebook_count, 0) AS notebook_count,
        COALESCE(note_counts.note_count, 0) AS total_notes
      FROM stacks s
      LEFT JOIN colors c ON s.color_id = c.id
      LEFT JOIN (
        SELECT stack_id, COUNT(*) AS notebook_count
        FROM notebooks
        GROUP BY stack_id
      ) notebook_counts ON s.id = notebook_counts.stack_id
      LEFT JOIN (
        SELECT 
          nb.stack_id,
          COUNT(*) AS note_count
        FROM notes n
        INNER JOIN notebooks nb ON n.notebook_id = nb.id
        WHERE n.trashed = 0
        GROUP BY nb.stack_id
      ) note_counts ON s.id = note_counts.stack_id
    `);

    console.info('Database views synced successfully');
  } catch (err) {
    console.error('Error syncing database views:', err.message || err);
    throw err;
  }
}

async function dropViews() {
  try {
    await database.query(`DROP VIEW IF EXISTS note_list_view`);
    await database.query(`DROP VIEW IF EXISTS note_summary_view`);
    await database.query(`DROP VIEW IF EXISTS user_stats_view`);
    await database.query(`DROP VIEW IF EXISTS notebook_summary_view`);
    await database.query(`DROP VIEW IF EXISTS stack_summary_view`);
  } catch (err) {
    console.error('Error dropping views:', err.message || err);
    // Don't throw - views might not exist yet
  }
}

module.exports = {
  syncViews,
  dropViews
};