const MindMap = require("../models/mindmap");

const sanitizeArray = (val) => (Array.isArray(val) ? val : []);

const ALLOWED_LAYOUTS = ["mindmap", "orgchart", "knowledgemap"];
const sanitizeLayout = (val) =>
  ALLOWED_LAYOUTS.includes(val) ? val : "mindmap";

const MindMapController = () => {
  /** GET /mindmaps — list current user's mind maps. */
  const getAllMindMaps = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, msg: "User not authenticated" });
      }
      const mindmaps = await MindMap.findAll({
        where: { user_id: req.user.id },
        order: [["updated_at", "DESC"]],
        attributes: [
          "id",
          "title",
          "layout_type",
          "nodes",
          "edges",
          "created_at",
          "updated_at",
        ],
      });
      // Compact the list response — clients only need a summary; keep nodes/edges but
      // they're small enough to ship for the cards.
      return res.status(200).json({
        success: true,
        data: { mindmaps: mindmaps.map((m) => m.toJSON()) },
      });
    } catch (error) {
      console.error("Get mindmaps error:", error);
      return res
        .status(500)
        .json({ success: false, msg: "Internal server error", error: error.message });
    }
  };

  /** GET /mindmaps/:id */
  const getMindMapById = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, msg: "User not authenticated" });
      }
      const { id } = req.params;
      const mindmap = await MindMap.findOne({
        where: { id, user_id: req.user.id },
      });
      if (!mindmap) {
        return res.status(404).json({ success: false, msg: "Mind map not found" });
      }
      return res.status(200).json({ success: true, data: { mindmap: mindmap.toJSON() } });
    } catch (error) {
      console.error("Get mindmap by id error:", error);
      return res
        .status(500)
        .json({ success: false, msg: "Internal server error", error: error.message });
    }
  };

  /** POST /mindmaps */
  const createMindMap = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, msg: "User not authenticated" });
      }
      const { title, nodes, edges, layout_type } = req.body || {};
      const created = await MindMap.create({
        user_id: req.user.id,
        title: (title && String(title).trim()) || "Untitled mind map",
        // Layout is locked at creation — once set, the update endpoint refuses
        // to change it (see updateMindMap).
        layout_type: sanitizeLayout(layout_type),
        nodes: sanitizeArray(nodes),
        edges: sanitizeArray(edges),
      });
      return res.status(201).json({
        success: true,
        msg: "Mind map created",
        data: { mindmap: created.toJSON() },
      });
    } catch (error) {
      console.error("Create mindmap error:", error);
      return res
        .status(500)
        .json({ success: false, msg: "Internal server error", error: error.message });
    }
  };

  /** PUT /mindmaps/:id */
  const updateMindMap = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, msg: "User not authenticated" });
      }
      const { id } = req.params;
      const mindmap = await MindMap.findOne({ where: { id, user_id: req.user.id } });
      if (!mindmap) {
        return res.status(404).json({ success: false, msg: "Mind map not found" });
      }
      const { title, nodes, edges } = req.body || {};
      // layout_type is intentionally NOT honoured here — the layout is locked
      // at creation time. Any client-sent layout_type is ignored.
      if (title !== undefined) mindmap.title = String(title).trim() || mindmap.title;
      if (nodes !== undefined) mindmap.nodes = sanitizeArray(nodes);
      if (edges !== undefined) mindmap.edges = sanitizeArray(edges);
      await mindmap.save();
      return res.status(200).json({
        success: true,
        msg: "Mind map updated",
        data: { mindmap: mindmap.toJSON() },
      });
    } catch (error) {
      console.error("Update mindmap error:", error);
      return res
        .status(500)
        .json({ success: false, msg: "Internal server error", error: error.message });
    }
  };

  /** DELETE /mindmaps/:id */
  const deleteMindMap = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, msg: "User not authenticated" });
      }
      const { id } = req.params;
      const mindmap = await MindMap.findOne({ where: { id, user_id: req.user.id } });
      if (!mindmap) {
        return res.status(404).json({ success: false, msg: "Mind map not found" });
      }
      await mindmap.destroy();
      return res.status(200).json({ success: true, msg: "Mind map deleted" });
    } catch (error) {
      console.error("Delete mindmap error:", error);
      return res
        .status(500)
        .json({ success: false, msg: "Internal server error", error: error.message });
    }
  };

  return {
    getAllMindMaps,
    getMindMapById,
    createMindMap,
    updateMindMap,
    deleteMindMap,
  };
};

module.exports = MindMapController();
