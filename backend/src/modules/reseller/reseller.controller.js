const path = require("path");
const resellerRepository = require("./reseller.repository");
const resellerService = require("./reseller.service");

const TEMPLATES = path.join(__dirname, "../../templates/pages");

function getResellerLoginPage(req, res) {
  return res.sendFile(path.join(TEMPLATES, "reseller-login.html"));
}

function getResellerDashboardPage(req, res) {
  return res.sendFile(path.join(TEMPLATES, "reseller-dashboard.html"));
}

async function apiLogin(req, res) {
  const { username, password } = req.body || {};
  const result = await resellerRepository.verifyLogin({ username, password });
  if (!result.ok) {
    return res.status(401).json({ ok: false, error: result.message || "Credenziali non valide" });
  }

  const { token, expiresAt } = await resellerRepository.createSessionToken({
    accountId: result.account.id,
    username: result.account.username,
    partnerCode: result.account.partnerCode,
  });

  res.setHeader("Set-Cookie", `reseller_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);
  return res.json({ ok: true, expiresAt, displayName: result.account.displayName });
}

async function apiLogout(req, res) {
  const token = req.resellerSessionToken;
  if (token) await resellerRepository.deleteSessionToken(token);
  res.setHeader("Set-Cookie", "reseller_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  return res.json({ ok: true });
}

async function apiGetDashboard(req, res) {
  const partnerCode = req.reseller.partnerCode;
  const result = await resellerService.getDashboard(partnerCode);
  if (!result.ok) {
    return res.status(400).json(result);
  }
  return res.json(result);
}

async function apiGetProfile(req, res) {
  const partner = await resellerService.getPartnerByCode(req.reseller.partnerCode);
  return res.json({
    ok: true,
    data: {
      username: req.reseller.username,
      partnerCode: req.reseller.partnerCode,
      partnerName: partner ? partner.name : req.reseller.partnerCode,
      country: partner ? partner.country : "—",
    },
  });
}

module.exports = {
  getResellerLoginPage,
  getResellerDashboardPage,
  apiLogin,
  apiLogout,
  apiGetDashboard,
  apiGetProfile,
};
