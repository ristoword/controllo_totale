const resellerRepository = require("./reseller.repository");

function parseCookies(req) {
  const header = req.headers && req.headers.cookie ? String(req.headers.cookie) : "";
  if (!header) return {};
  return header.split(";").reduce((acc, part) => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return acc;
    acc[k] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function isApiRequest(req) {
  return String(req.path || "").startsWith("/api/reseller");
}

async function requireReseller(req, res, next) {
  try {
    const cookies = parseCookies(req);
    const token = cookies.reseller_session;
    const session = await resellerRepository.verifySessionToken(token);
    if (!session) {
      if (isApiRequest(req)) {
        return res.status(401).json({ ok: false, error: "non_autorizzato" });
      }
      return res.redirect("/reseller-login");
    }

    if (token) await resellerRepository.touchSession(token);

    req.reseller = {
      accountId: session.accountId,
      username: session.username,
      partnerCode: session.partnerCode,
    };
    req.resellerSessionToken = token;
    return next();
  } catch (e) {
    if (isApiRequest(req)) {
      return res.status(500).json({ ok: false, error: "reseller_error", message: e?.message || String(e) });
    }
    return res.redirect("/reseller-login");
  }
}

module.exports = { requireReseller };
