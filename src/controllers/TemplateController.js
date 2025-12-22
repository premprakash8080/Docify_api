const Template = require("../models/template");
const Note = require("../models/note"); // For cloning logic if needed
const { Op } = require("sequelize");
const Notebook = require("../models/notebook");
const { initializeNoteContent } = require("../utils/noteFirestoreHelper");
const Sequelize = require("sequelize");
const { resolveNotebookId, getFormattedNoteResponse } = require("../utils/noteHelpers");
const { v4: uuidv4 } = require("uuid");

const TemplateController = () => {
  /**
   * Get all templates (system + user templates)
   * System templates: user_id IS NULL
   * User templates: user_id = req.user.id
   */
  const getAllTemplates = async (req, res) => {
    try {
      const userId = req.user.id;

      const templates = await Template.findAll({
        where: {
          [Op.or]: [
            { user_id: userId },
            { user_id: null } // System templates
          ]
        },
        order: [["is_system", "DESC"], ["name", "ASC"]], // System first, then alphabetical
        attributes: ["id", "name", "description", "image_url", "content", "user_id", "is_system", "createdAt", "updatedAt"] // Adjust attributes as per your model
      });

      return res.status(200).json({
        success: true,
        msg: "All templates fetched successfully",
        data: { templates }
      });
    } catch (error) {
      console.error("Get all templates error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message
      });
    }
  };

  /**
   * Get only system (prebuilt) templates
   */
  const getSystemTemplates = async (req, res) => {
    try {
      const templates = await Template.findAll({
        where: { is_system: true },
        order: [["name", "ASC"]],
        attributes: ["id", "name", "description", "image_url", "content", "user_id", "is_system", "createdAt", "updatedAt"]
      });

      const TRIM_LENGTH = 300; // adjust as needed

      const trimmedTemplates = templates.map(template => {
        const data = template.toJSON();
  
        return {
          ...data,
          content: data.content
            ? data.content.substring(0, TRIM_LENGTH)
            : ""
        };
      });
  

      return res.status(200).json({
        success: true,
        msg: "System templates fetched successfully",
        data: { templates: trimmedTemplates }
      });
    } catch (error) {
      console.error("Get system templates error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message
      });
    }
  };

  /**
   * Get only user's own templates
   */
  const getUserTemplates = async (req, res) => {
    try {
      const userId = req.user.id;

      const templates = await Template.findAll({
        where: { user_id: userId, is_system: false },
        order: [["name", "ASC"]],
        attributes: ["id", "name", "description", "image_url", "content", "user_id", "is_system", "createdAt", "updatedAt"]
      });

      const TRIM_LENGTH = 300; // adjust as needed

      const trimmedTemplates = templates.map(template => {
        const data = template.toJSON();

        return {
          ...data,
          content: data.content
            ? data.content.substring(0, TRIM_LENGTH)
            : ""
        };
      });
  

      return res.status(200).json({
        success: true,
        msg: "User templates fetched successfully",
        data: { templates: trimmedTemplates }
      });
    } catch (error) {
      console.error("Get user templates error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message
      });
    }
  };

  /**
   * Get a single template by ID (accessible if system or belongs to user)
   */
  const getTemplateById = async (req, res) => {
    try {
      const { templateId } = req.query;
      const userId = req.user.id;

      const template = await Template.findOne({
        where: {
          id: templateId,
          [Op.or]: [
            { user_id: userId },
            { user_id: null }
          ]
        }
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          msg: "Template not found or access denied"
        });
      }

      return res.status(200).json({
        success: true,
        msg: "Template fetched successfully",
        data: { template }
      });
    } catch (error) {
      console.error("Get template by ID error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message
      });
    }
  };

  /**
   * Create a new user template
   * Expected body: { name, content }
   */
  const createTemplate = async (req, res) => {
    try {
      const { name, content, description, image_url, content_type } = req.body;
      const userId = req.user.id;

      if (!name || !content) {
        return res.status(400).json({
          success: false,
          msg: "Name and content are required"
        });
      }

      const newTemplate = await Template.create({
        name,
        content,
        user_id: userId,
        is_system: false,
        description: description || null,
        image_url: image_url || null,
        content_type: content_type || "tiptap"
      });

      return res.status(201).json({
        success: true,
        msg: "Template created successfully",
        data: { template: newTemplate }
      });
    } catch (error) {
      console.error("Create template error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message
      });
    }
  };

  /**
   * Clone a template (system or user) → create a new user-owned template
   */
  const cloneTemplate = async (req, res) => {
    try {
      const { templateId, notebook_id } = req.body; // Allow optional notebook_id override
      const userId = req.user.id;
  
      if (!templateId) {
        return res.status(400).json({
          success: false,
          msg: "templateId is required",
        });
      }
  
      // 1. Fetch the template (system or user-owned)
      const template = await Template.findOne({
        where: {
          id: templateId,
          [Sequelize.Op.or]: [
            { user_id: userId },
            { user_id: null }, // System templates
          ],
        },
      });
  
      if (!template) {
        return res.status(404).json({
          success: false,
          msg: "Template not found or access denied",
        });
      }
  
      // 2. Resolve notebook: use provided notebook_id if valid, else default
      const notebookId = await resolveNotebookId(userId, notebook_id);
  
      // 3. Generate a UUID for Firebase document ID
      const firebaseDocId = uuidv4();
  
      // 4. Initialize content in Firebase using the UUID
      await initializeNoteContent(firebaseDocId, {
        title: template.title || "Untitled Note",
        content: template.content || "",
        user_id: userId,
        notebook_id: notebookId,
        is_trashed: false,
      });
  
      // 5. Create the Note record in MySQL
      const newNote = await Note.create({
        user_id: userId,
        notebook_id: notebookId,
        firebase_document_id: firebaseDocId,
        title: template.title || "Untitled Note",
        template_id: template.id,        // Track which template was used
        pinned: false,
        archived: false,
        trashed: false,
        version: 1,
        synced: false,
      });
  
      // 6. Get full formatted response (same structure as createNote and getNoteById)
      const responseData = await getFormattedNoteResponse(newNote.id, userId);
  
      // 7. Success response
      return res.status(201).json({
        success: true,
        msg: "Note successfully created from template",
        data: {
          note: responseData,
        },
      });
    } catch (error) {
      console.error("Clone template error:", error);
      return res.status(500).json({
        success: false,
        msg: "Failed to clone template into note",
        error: error.message,
      });
    }
  };

  /**
   * Delete a user-owned template
   */
  const deleteTemplate = async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const template = await Template.findOne({
        where: {
          id,
          user_id: userId // Only allow deleting own templates
        }
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          msg: "Template not found or access denied"
        });
      }

      await template.destroy();

      return res.status(200).json({
        success: true,
        msg: "Template deleted successfully"
      });
    } catch (error) {
      console.error("Delete template error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message
      });
    }
  };


  const getOrCreateDefaultNotebook = async (userId) => {
    const [notebook] = await Notebook.findAll({
      where: { user_id: userId },
      order: [["created_at", "ASC"]],
      limit: 1,
      attributes: ["id"],
    });
  
    if (notebook) {
      return notebook.id;
    }
  
    const defaultNotebook = await Notebook.create({
      user_id: userId,
      name: "Untitled",
      description: null,
      stack_id: null,
      color_id: null,
      sort_order: 0,
    });
  
    return defaultNotebook.id;
  };

  return {
    getAllTemplates,
    getSystemTemplates,
    getUserTemplates,
    getTemplateById,
    createTemplate,
    cloneTemplate,
    deleteTemplate
  };
};

module.exports = TemplateController();