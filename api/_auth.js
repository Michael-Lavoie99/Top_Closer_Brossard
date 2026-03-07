const crypto = require("crypto");

const SESSION_TTL_SECONDS = 60 * 60 * 12;

function encodeBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function parseCsvList(value) {
  return String(value || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function signPayload(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${data}.${signature}`;
}

function verifySignedPayload(token, secret) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const data = `${parts[0]}.${parts[1]}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  if (parts[2].length !== expected.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected))) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    if (!payload?.exp || Math.floor(Date.now() / 1000) >= Number(payload.exp)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function validateGoogleCredential(credential) {
  if (!credential || typeof credential !== "string") {
    throw new Error("Google credential invalide");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID manquant");
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
    { method: "GET" }
  );

  if (!response.ok) {
    throw new Error("Token Google invalide");
  }

  const tokenInfo = await response.json();
  const audience = tokenInfo?.aud;
  const email = String(tokenInfo?.email || "").toLowerCase();
  const emailVerified = String(tokenInfo?.email_verified || "").toLowerCase() === "true";
  const hostedDomain = String(tokenInfo?.hd || "").toLowerCase();

  if (audience !== clientId) {
    throw new Error("Audience Google non autorisee");
  }

  if (!email || !emailVerified) {
    throw new Error("Courriel Google non verifie");
  }

  const allowedDomains = parseCsvList(process.env.ALLOWED_GOOGLE_DOMAINS);
  const allowedEmails = parseCsvList(process.env.ALLOWED_GOOGLE_EMAILS);
  const emailDomain = email.includes("@") ? email.split("@")[1] : "";

  if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
    throw new Error("Ce courriel n est pas autorise");
  }

  if (allowedDomains.length > 0) {
    const hasDomainMatch = allowedDomains.includes(emailDomain) || (hostedDomain && allowedDomains.includes(hostedDomain));
    if (!hasDomainMatch) {
      throw new Error("Ce domaine n est pas autorise");
    }
  }

  return {
    sub: String(tokenInfo.sub || ""),
    email,
    name: String(tokenInfo.name || email),
    picture: String(tokenInfo.picture || ""),
    hostedDomain
  };
}

function createSessionToken(user) {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET manquant");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.sub,
    email: user.email,
    name: user.name,
    picture: user.picture,
    iat: now,
    exp: now + SESSION_TTL_SECONDS
  };

  return signPayload(payload, secret);
}

function verifySessionToken(token) {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) return null;
  return verifySignedPayload(token, secret);
}

function getBearerToken(req) {
  const raw = req.headers?.authorization || req.headers?.Authorization;
  if (!raw || typeof raw !== "string") return "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function setAuthCors(res, methods = "GET, POST, OPTIONS") {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function requireAuth(req, res) {
  const token = getBearerToken(req);
  const user = verifySessionToken(token);

  if (!user) {
    res.status(401).json({ error: "Authentification requise" });
    return null;
  }

  return user;
}

module.exports = {
  createSessionToken,
  getBearerToken,
  requireAuth,
  setAuthCors,
  validateGoogleCredential,
  verifySessionToken
};
