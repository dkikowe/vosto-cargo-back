import { parseOrderRequest } from "../services/AIService.js";

export const parseOrder = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });
    
    const result = await parseOrderRequest(text);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
