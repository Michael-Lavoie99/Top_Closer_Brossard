const { setAuthCors } = require("../_auth");

module.exports = async (req, res) => {
  setAuthCors(res, "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: "GOOGLE_CLIENT_ID is missing" });
  }

  return res.status(200).json({ googleClientId: process.env.GOOGLE_CLIENT_ID });
};
