const { requireAuth, setAuthCors } = require("./_auth");
const { normalizeConversation, runEvaluation, runModuleEvaluation } = require("./_evaluation");

module.exports = async (req, res) => {
  setAuthCors(res, "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const body = typeof req.body === "object" && req.body !== null ? req.body : {};
    const context = body.context || {};
    const conversation = normalizeConversation(body.conversation || []);
    const evaluator = String(context?.mode || "").toLowerCase() === "module" ? runModuleEvaluation : runEvaluation;
    const result = await evaluator({
      context,
      conversation,
      apiKey: process.env.OPENAI_API_KEY
    });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("OpenAI request failed:") ? 502 : 500;
    return res.status(status).json({
      error: "Server error",
      details: message
    });
  }
};
