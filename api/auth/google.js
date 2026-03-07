const { createSessionToken, setAuthCors, validateGoogleCredential } = require("../_auth");

module.exports = async (req, res) => {
  setAuthCors(res, "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = typeof req.body === "object" && req.body !== null ? req.body : {};
    const credential = body.credential;

    const user = await validateGoogleCredential(credential);
    const token = createSessionToken(user);

    return res.status(200).json({
      token,
      user: {
        email: user.email,
        name: user.name,
        picture: user.picture
      }
    });
  } catch (error) {
    return res.status(401).json({
      error: "Connexion Google refusee",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
