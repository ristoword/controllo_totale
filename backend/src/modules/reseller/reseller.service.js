const path = require("path");
const { safeReadJson } = require("../../utils/safeFileIO");
const paths = require("../../config/paths");
const licensesRepository = require("../../repositories/licenses.repository");

const PARTNERS_FILE = path.join(paths.DATA, "config", "partners.json");

function readPartners() {
  return safeReadJson(PARTNERS_FILE, { partners: [] });
}

function getPartnerByCode(code) {
  const { partners } = readPartners();
  return (partners || []).find((p) => p.code === code) || null;
}

function licenseStatus(lic) {
  if (!lic) return "unknown";
  if (lic.status === "suspended") return "suspended";
  if (lic.status === "revoked") return "revoked";
  if (lic.expiresAt && new Date(lic.expiresAt).getTime() < Date.now()) return "expired";
  if (lic.status === "trial") return "trial";
  return "active";
}

async function getDashboard(partnerCode) {
  const partner = getPartnerByCode(partnerCode);
  if (!partner) {
    return { ok: false, error: "Partner non trovato" };
  }

  const allLicenses = await licensesRepository.readLicenses();
  const partnerLicenses = allLicenses.filter(
    (l) => l.partnerCode === partnerCode
  );

  const licenses = partnerLicenses.map((l) => {
    const status = licenseStatus(l);
    return {
      tenantId: l.restaurantId || l.tenantId || l.id,
      tenantName: l.restaurantName || l.tenantName || l.restaurantId || l.id,
      plan: l.plan || "controllo_totale_pro",
      status,
      activatedAt: l.activatedAt || l.createdAt,
      expiresAt: l.expiresAt,
      licensePrice: partner.licensePrice || 0,
      commissionEuros: status === "active" ? (partner.commissionEuros || 0) : 0,
    };
  });

  const active = licenses.filter((l) => l.status === "active").length;
  const trial = licenses.filter((l) => l.status === "trial").length;
  const expired = licenses.filter((l) => l.status === "expired" || l.status === "suspended" || l.status === "revoked").length;
  const totalCommissionEuros = licenses
    .filter((l) => l.status === "active")
    .reduce((sum, l) => sum + (l.commissionEuros || 0), 0);

  return {
    ok: true,
    data: {
      partner: {
        code: partner.code,
        name: partner.name,
        country: partner.country,
        licensePrice: partner.licensePrice,
        commissionEuros: partner.commissionEuros,
      },
      summary: {
        total: licenses.length,
        active,
        trial,
        expired,
        totalCommissionEuros,
      },
      licenses,
    },
  };
}

module.exports = { getDashboard, getPartnerByCode };
