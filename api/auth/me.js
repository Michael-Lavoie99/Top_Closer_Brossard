const { requireAuth, setAuthCors } = require("../_auth");

module.exports = async (req, res) => {
  setAuthCors(res, "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireAuth(req, res);
  if (!user) return;

  return res.status(200).json({
    user: {
      email: user.email,
      name: user.name,
      picture: user.picture
    }
  });
};
