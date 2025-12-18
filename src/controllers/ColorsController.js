// controllers/ColorsController.js

const Color = require('../models/color');

const colorsController = () => {
  /**
   * @description Create a new color (Admin only recommended)
   * @param req.body.name - Color name (e.g., "Red")
   * @param req.body.hex_code - Hex code (e.g., "#FF0000")
   * @returns created color
   */
  const createColor = async (req, res) => {
    try {
      const { name, hex_code } = req.body;

      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          msg: 'Color name is required',
        });
      }

      if (!hex_code || hex_code.trim() === '') {
        return res.status(400).json({
          success: false,
          msg: 'Hex code is required',
        });
      }

      // Validate hex code format
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      if (!hexRegex.test(hex_code.trim())) {
        return res.status(400).json({
          success: false,
          msg: 'Invalid hex_code format. Must be in #RRGGBB format (e.g., #FF0000)',
        });
      }

      // Check if color with same name or hex_code already exists
      const existingColor = await Color.findOne({
        where: {
          [require('sequelize').Op.or]: [
            { name: name.trim() },
            { hex_code: hex_code.trim().toUpperCase() },
          ],
        },
      });

      if (existingColor) {
        return res.status(409).json({
          success: false,
          msg: 'A color with this name or hex code already exists',
        });
      }

      // Create color
      const color = await Color.create({
        name: name.trim(),
        hex_code: hex_code.trim().toUpperCase(),
      });

      return res.status(201).json({
        success: true,
        msg: 'Color created successfully',
        data: {
          color,
        },
      });
    } catch (error) {
      console.error('Create color error:', error);
      return res.status(500).json({
        success: false,
        msg: 'Internal server error',
      });
    }
  };

  /**
   * @description Get all colors
   * @returns list of all colors
   */
  const getAllColors = async (req, res) => {
    try {
      const colors = await Color.findAll({
        attributes: ['id', 'name', 'hex_code', 'created_at', 'updated_at'],
        order: [['name', 'ASC']],
      });

      return res.status(200).json({
        success: true,
        data: {
          colors,
          count: colors.length,
        },
      });
    } catch (error) {
      console.error('Get all colors error:', error);
      return res.status(500).json({
        success: false,
        msg: 'Internal server error',
      });
    }
  };

  /**
   * @description Get a single color by ID
   * @param req.params.id - Color ID
   * @returns color object
   */
  const getColorById = async (req, res) => {
    try {
      const { id } = req.params;

      const color = await Color.findByPk(id, {
        attributes: ['id', 'name', 'hex_code', 'created_at', 'updated_at'],
      });

      if (!color) {
        return res.status(404).json({
          success: false,
          msg: 'Color not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: { color },
      });
    } catch (error) {
      console.error('Get color by ID error:', error);
      return res.status(500).json({
        success: false,
        msg: 'Internal server error',
      });
    }
  };

  /**
   * @description Update a color
   * @param req.params.id - Color ID
   * @param req.body.name - New name (optional)
   * @param req.body.hex_code - New hex code (optional)
   * @returns updated color
   */
  const updateColor = async (req, res) => {
    try {
      const { id } = req.params;
      const { name, hex_code } = req.body;

      if (!name && !hex_code) {
        return res.status(400).json({
          success: false,
          msg: 'At least one field (name or hex_code) is required to update',
        });
      }

      if (hex_code && !/^#[0-9A-Fa-f]{6}$/.test(hex_code.trim())) {
        return res.status(400).json({
          success: false,
          msg: 'Invalid hex_code format. Must be in #RRGGBB format',
        });
      }

      const color = await Color.findByPk(id);

      if (!color) {
        return res.status(404).json({
          success: false,
          msg: 'Color not found',
        });
      }

      // Check uniqueness if name or hex_code is being changed
      if (name || hex_code) {
        const whereClause = {
          [require('sequelize').Op.or]: [],
        };

        if (name) whereClause[require('sequelize').Op.or].push({ name: name.trim() });
        if (hex_code) whereClause[require('sequelize').Op.or].push({ hex_code: hex_code.trim().toUpperCase() });

        whereClause.id = { [require('sequelize').Op.ne]: id };

        const existingColor = await Color.findOne({ where: whereClause });

        if (existingColor) {
          return res.status(409).json({
            success: false,
            msg: 'Another color with this name or hex code already exists',
          });
        }
      }

      // Update fields
      await color.update({
        name: name ? name.trim() : color.name,
        hex_code: hex_code ? hex_code.trim().toUpperCase() : color.hex_code,
      });

      return res.status(200).json({
        success: true,
        msg: 'Color updated successfully',
        data: { color },
      });
    } catch (error) {
      console.error('Update color error:', error);
      return res.status(500).json({
        success: false,
        msg: 'Internal server error',
      });
    }
  };

  /**
   * @description Delete a color
   * @param req.params.id - Color ID
   * @returns success message
   */
  const deleteColor = async (req, res) => {
    try {
      const { id } = req.params;

      const color = await Color.findByPk(id);

      if (!color) {
        return res.status(404).json({
          success: false,
          msg: 'Color not found',
        });
      }

      await color.destroy();

      return res.status(200).json({
        success: true,
        msg: 'Color deleted successfully',
      });
    } catch (error) {
      console.error('Delete color error:', error);
      return res.status(500).json({
        success: false,
        msg: 'Internal server error',
      });
    }
  };

  return {
    createColor,
    getAllColors,
    getColorById,
    updateColor,
    deleteColor,
  };
};

module.exports = colorsController;