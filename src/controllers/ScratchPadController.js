const ScratchPad = require("../models/scratchPad");

const ScratchPadController = () => {
  /**
   * @description Get scratch pad content for the authenticated user
   * @param req.user - User from authentication middleware
   * @returns scratch pad content
   */
  const getScratchPad = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      // Find or create scratch pad for user
      let scratchPad = await ScratchPad.findOne({
        where: {
          user_id: req.user.id,
        },
      });

      // If scratch pad doesn't exist, create one with empty content
      if (!scratchPad) {
        scratchPad = await ScratchPad.create({
          user_id: req.user.id,
          content: "",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          content: scratchPad.content || "",
          updated_at: scratchPad.updated_at,
        },
      });
    } catch (error) {
      console.error("Get scratch pad error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Update scratch pad content for the authenticated user
   * @param req.user - User from authentication middleware
   * @param req.body.content - New scratch pad content
   * @returns updated scratch pad content
   */
  const updateScratchPad = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      const { content } = req.body;

      if (content === undefined) {
        return res.status(400).json({
          success: false,
          msg: "Content is required",
        });
      }

      // Find or create scratch pad for user
      let scratchPad = await ScratchPad.findOne({
        where: {
          user_id: req.user.id,
        },
      });

      if (!scratchPad) {
        // Create new scratch pad
        scratchPad = await ScratchPad.create({
          user_id: req.user.id,
          content: content || "",
        });
      } else {
        // Update existing scratch pad
        scratchPad.content = content || "";
        await scratchPad.save();
      }

      return res.status(200).json({
        success: true,
        data: {
          content: scratchPad.content || "",
          updated_at: scratchPad.updated_at,
        },
      });
    } catch (error) {
      console.error("Update scratch pad error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  /**
   * @description Clear/reset scratch pad content for the authenticated user
   * @param req.user - User from authentication middleware
   * @returns cleared scratch pad content
   */
  const clearScratchPad = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          msg: "User not authenticated",
        });
      }

      // Find or create scratch pad for user
      let scratchPad = await ScratchPad.findOne({
        where: {
          user_id: req.user.id,
        },
      });

      if (!scratchPad) {
        // Create new scratch pad with empty content
        scratchPad = await ScratchPad.create({
          user_id: req.user.id,
          content: "",
        });
      } else {
        // Clear existing scratch pad
        scratchPad.content = "";
        await scratchPad.save();
      }

      return res.status(200).json({
        success: true,
        data: {
          content: "",
          updated_at: scratchPad.updated_at,
        },
      });
    } catch (error) {
      console.error("Clear scratch pad error:", error);
      return res.status(500).json({
        success: false,
        msg: "Internal server error",
        error: error.message,
      });
    }
  };

  return {
    getScratchPad,
    updateScratchPad,
    clearScratchPad,
  };
};

module.exports = ScratchPadController();

