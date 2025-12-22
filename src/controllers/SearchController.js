const { Op } = require("sequelize");
const Note = require("../models/note");
const Notebook = require("../models/notebook");
const Tag = require("../models/tag");
const Stack = require("../models/stack");
const Task = require("../models/task");

const SearchController = () => {
  /**
   * @description Global search across notes, notebooks, tags, stacks, and tasks
   * @param req.user - User from authentication middleware
   * @param req.query.query - Search query string (required)
   * @param req.query.filters - Array of notebook IDs to filter by (optional)
   * @param req.query.types - Array of entity types to search (optional: note, notebook, tag, stack, task)
   * @returns search results across all entity types
   */
  const globalSearch = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { query, filters, types } = req.query;

      if (!query || query.trim() === "") {
        return res.status(400).json({
          success: false,
          msg: "Search query is required",
        });
      }

      const searchQuery = query.trim();
      const userId = req.user.id;
      const results = [];

      // Parse filters (notebook IDs)
      const notebookFilters = filters
        ? Array.isArray(filters)
          ? filters
          : [filters]
        : [];

      // Parse types (default to all if not specified)
      const searchTypes = types
        ? Array.isArray(types)
          ? types
          : [types]
        : ["note", "notebook", "tag", "stack", "task"];

      // Search in Notes
      if (searchTypes.includes("note")) {
        const noteWhere = {
          user_id: userId,
          trashed: false,
          [Op.or]: [
            { title: { [Op.like]: `%${searchQuery}%` } },
            // Note: Content search would require Firebase, which is slow
            // For now, we only search by title
          ],
        };

        if (notebookFilters.length > 0) {
          noteWhere.notebook_id = { [Op.in]: notebookFilters };
        }

        const notes = await Note.findAll({
          where: noteWhere,
          include: [
            {
              model: Notebook,
              as: "notebook",
              required: false,
              include: [
                {
                  model: Stack,
                  as: "stack",
                  required: false,
                  attributes: ["id", "name"],
                },
              ],
              attributes: ["id", "name"],
            },
          ],
          attributes: [
            "id",
            "title",
            "notebook_id",
            "created_at",
            "updated_at",
          ],
          limit: 50, // Limit results per type
        });

        for (const note of notes) {
          const noteData = note.toJSON();
          results.push({
            id: noteData.id,
            type: "note",
            title: noteData.title,
            content: null, // Content would require Firebase fetch
            notebook_id: noteData.notebook_id || null,
            notebook_name: noteData.notebook?.name || null,
            stack_name: noteData.notebook?.stack?.name || null,
            created_at: noteData.created_at,
            updated_at: noteData.updated_at,
          });
        }
      }

      // Search in Notebooks
      if (searchTypes.includes("notebook")) {
        const notebookWhere = {
          user_id: userId,
          [Op.or]: [
            { name: { [Op.like]: `%${searchQuery}%` } },
            { description: { [Op.like]: `%${searchQuery}%` } },
          ],
        };

        if (notebookFilters.length > 0) {
          notebookWhere.id = { [Op.in]: notebookFilters };
        }

        const notebooks = await Notebook.findAll({
          where: notebookWhere,
          include: [
            {
              model: Stack,
              as: "stack",
              required: false,
              attributes: ["id", "name"],
            },
          ],
          attributes: [
            "id",
            "name",
            "description",
            "stack_id",
            "created_at",
            "updated_at",
          ],
          limit: 50,
        });

        for (const notebook of notebooks) {
          const notebookData = notebook.toJSON();
          results.push({
            id: notebookData.id,
            type: "notebook",
            name: notebookData.name,
            description: notebookData.description || null,
            stack_id: notebookData.stack_id || null,
            stack_name: notebookData.stack?.name || null,
            created_at: notebookData.created_at,
            updated_at: notebookData.updated_at,
          });
        }
      }

      // Search in Tags
      if (searchTypes.includes("tag")) {
        const tags = await Tag.findAll({
          where: {
            user_id: userId,
            name: { [Op.like]: `%${searchQuery}%` },
          },
          attributes: ["id", "name", "color_id", "created_at"],
          limit: 50,
        });

        for (const tag of tags) {
          const tagData = tag.toJSON();
          results.push({
            id: tagData.id,
            type: "tag",
            name: tagData.name,
            color_id: tagData.color_id || null,
            created_at: tagData.created_at,
          });
        }
      }

      // Search in Stacks
      if (searchTypes.includes("stack")) {
        const stacks = await Stack.findAll({
          where: {
            user_id: userId,
            name: { [Op.like]: `%${searchQuery}%` },
          },
          attributes: ["id", "name", "created_at", "updated_at"],
          limit: 50,
        });

        for (const stack of stacks) {
          const stackData = stack.toJSON();
          results.push({
            id: stackData.id,
            type: "stack",
            name: stackData.name,
            created_at: stackData.created_at,
            updated_at: stackData.updated_at,
          });
        }
      }

      // Search in Tasks
      if (searchTypes.includes("task")) {
        const taskWhere = {
          [Op.or]: [
            { label: { [Op.like]: `%${searchQuery}%` } },
            { description: { [Op.like]: `%${searchQuery}%` } },
          ],
        };

        const tasks = await Task.findAll({
          where: taskWhere,
          include: [
            {
              model: Note,
              as: "note",
              where: {
                user_id: userId,
                trashed: false,
              },
              required: true,
              include: [
                {
                  model: Notebook,
                  as: "notebook",
                  required: false,
                  include: [
                    {
                      model: Stack,
                      as: "stack",
                      required: false,
                      attributes: ["id", "name"],
                    },
                  ],
                  attributes: ["id", "name"],
                },
              ],
              attributes: ["id", "notebook_id"],
            },
          ],
          attributes: [
            "id",
            "label",
            "description",
            "note_id",
            "completed",
            "start_date",
            "start_time",
            "end_time",
            "created_at",
            "updated_at",
          ],
          limit: 50,
        });

        for (const task of tasks) {
          const taskData = task.toJSON();
          results.push({
            id: taskData.id,
            type: "task",
            label: taskData.label,
            description: taskData.description || null,
            note_id: taskData.note_id || null,
            notebook_id: taskData.note?.notebook_id || null,
            notebook_name: taskData.note?.notebook?.name || null,
            stack_name: taskData.note?.notebook?.stack?.name || null,
            completed: taskData.completed || false,
            start_date: taskData.start_date || null,
            start_time: taskData.start_time || null,
            end_time: taskData.end_time || null,
            created_at: taskData.created_at,
            updated_at: taskData.updated_at,
          });
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          results,
        },
      });
    } catch (error) {
      console.error("Global search error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  return {
    globalSearch,
  };
};

module.exports = SearchController();

