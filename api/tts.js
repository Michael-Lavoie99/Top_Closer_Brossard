const { requireAuth, setAuthCors } = require("./_auth");

const DEFAULT_TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const DEFAULT_TTS_FORMAT = "mp3";
const FALLBACK_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

function parseAllowedVoices() {
  const raw = String(process.env.OPENAI_TTS_VOICES || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return raw.length ? raw : FALLBACK_VOICES;
}

function normalizeVoice(requestedVoice) {
  const voice = String(requestedVoice || "").trim();
  const allowed = parseAllowedVoices();
  if (!voice) return allowed[0];
  return allowed.includes(voice) ? voice : allowed[0];
}

module.exports = async (req, res) => {
  setAuthCors(res, "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const user = requireAuth(req, res);
  if (!user) return;
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY is missing" });

  try {
    const body = typeof req.body === "object" && req.body !== null ? req.body : {};
    const text = String(body.text || "").trim();
    if (!text) return res.status(400).json({ error: "Text required" });

    const voice = normalizeVoice(body.voice);
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: DEFAULT_TTS_MODEL,
        voice,
        format: DEFAULT_TTS_FORMAT,
        input: text.slice(0, 4000)
      })
    });

    if (!response.ok) {
      const details = await response.text();
      return res.status(response.status).json({ error: "OpenAI TTS request failed", details });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

