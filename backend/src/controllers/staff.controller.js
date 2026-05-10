// Staff = gestione utenti. Owner: CRUD completo. Supervisor: sola lettura (GET list, GET :id) per elenco/dropdown.
// Self-service: GET/PATCH /me e derivati (solo utente collegato alla sessione).

const bcrypt = require("bcrypt");
const crypto = require("crypto");
const usersRepository = require("../repositories/users.repository");
const staffRepository = require("../repositories/staff.repository");
const shiftsRepository = require("../repositories/shifts.repository");
const staffShiftsService = require("../service/staff-shifts.service");
const staffHoursService = require("../service/staff-hours.service");
const staffRequestsService = require("../service/staff-requests.service");

const BCRYPT_ROUNDS = 10;

function ensureOwner(req, res) {
  const role = req.session && req.session.user && req.session.user.role;
  if (role !== "owner") {
    res.status(403).json({ error: "Solo l'owner può gestire lo staff." });
    return false;
  }
  const restaurantId = req.session.user.restaurantId || req.session.restaurantId;
  if (!restaurantId) {
    res.status(403).json({ error: "Ristorante non in sessione." });
    return false;
  }
  return restaurantId;
}

/** Owner o supervisor: restituisce restaurantId (per lettura elenco/dettaglio). Supervisor usa session o "default". */
function ensureOwnerOrSupervisor(req, res) {
  const role = req.session && req.session.user && req.session.user.role;
  if (role !== "owner" && role !== "supervisor") {
    res.status(403).json({ error: "Accesso non autorizzato." });
    return false;
  }
  const restaurantId = req.session.user?.restaurantId || req.session.restaurantId || "default";
  return restaurantId;
}

function sanitizeUser(u) {
  if (!u) return null;
  const { password, ...out } = u;
  return { ...out, active: u.is_active !== false };
}

/** Profilo unificato (users + staff.json opzionale) come in supervisor/staff UI */
function mergeUserWithStaffProfile(user, staffRow) {
  if (!user) return null;
  const base = sanitizeUser(user);
  const pFromStaff = (staffRow && staffRow.personal) || {};
  const personal = {
    name: pFromStaff.name || base.name || "",
    surname: pFromStaff.surname || base.surname || "",
    email: base.email || pFromStaff.email || "",
    phone: base.phone || pFromStaff.phone || "",
    address: base.address || pFromStaff.address || "",
    birthDate: pFromStaff.birthDate || "",
    employeeCode: pFromStaff.employeeCode || "",
    hireDate:
      pFromStaff.hireDate ||
      (base.createdAt ? String(base.createdAt).slice(0, 10) : "") ||
      "",
  };
  const work = staffRow && staffRow.work ? { ...staffRow.work } : {};
  if (!work.department && base.role) work.department = base.role;
  if (!work.role && base.role) work.role = base.role;
  return {
    ...base,
    personal,
    work,
    salary: (staffRow && staffRow.salary) || {},
    attendance: (staffRow && staffRow.attendance) || {},
    vacations: (staffRow && staffRow.vacations) || {},
    discipline: (staffRow && staffRow.discipline) || {
      warnings: [],
      managerNotes: [],
      staffNotes: [],
      importantEvents: [],
    },
  };
}

async function loadStaffRowSafe(userId) {
  try {
    return await staffRepository.getById(String(userId));
  } catch (_) {
    return null;
  }
}

// GET /api/staff – owner e supervisor: elenco utenti con stesso restaurantId (esclusa password)
exports.listStaff = async (req, res) => {
  const restaurantId = ensureOwnerOrSupervisor(req, res);
  if (!restaurantId) return;

  const users = await usersRepository.findByRestaurantId(restaurantId);
  const staffOnly = users.filter((u) => String(u.role).toLowerCase() !== "owner");
  const list = staffOnly.map(sanitizeUser);
  res.json(list);
};

// GET /api/staff/:id – owner e supervisor: dettaglio utente (sola lettura), allineato a staff.json se presente
exports.getStaffById = async (req, res) => {
  const restaurantId = ensureOwnerOrSupervisor(req, res);
  if (!restaurantId) return;

  const user = await usersRepository.findById(req.params.id);
  if (!user || user.restaurantId !== restaurantId) {
    return res.status(404).json({ error: "Utente non trovato." });
  }
  const staffRow = await loadStaffRowSafe(user.id);
  res.json(mergeUserWithStaffProfile(user, staffRow));
};

// POST /api/staff – crea dipendente/utente
exports.createStaff = async (req, res) => {
  const restaurantId = ensureOwner(req, res);
  if (!restaurantId) return;

  const { name, surname, role, username, password } = req.body || {};
  if (!username || typeof username !== "string" || !username.trim()) {
    return res.status(400).json({ error: "Username obbligatorio." });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password obbligatoria (min. 6 caratteri)." });
  }

  const hash = await bcrypt.hash(String(password).trim(), BCRYPT_ROUNDS);
  const record = await usersRepository.createUser({
    name: name != null ? String(name).trim() : "",
    surname: surname != null ? String(surname).trim() : "",
    username: String(username).trim(),
    password: hash,
    role: (role && String(role).trim()) || "staff",
    restaurantId,
    is_active: true,
    mustChangePassword: true,
  });

  if (!record) {
    return res.status(409).json({ error: "Username già esistente." });
  }
  res.status(201).json(sanitizeUser(record));
};

// PATCH /api/staff/:id – modifica nome, ruolo, stato
exports.updateStaff = async (req, res) => {
  const restaurantId = ensureOwner(req, res);
  if (!restaurantId) return;

  const id = req.params.id;
  const user = await usersRepository.findById(id);
  if (!user || user.restaurantId !== restaurantId) {
    return res.status(404).json({ error: "Utente non trovato." });
  }

  const { name, surname, role, active, hourlyRate, employmentType } = req.body || {};
  const patch = {};
  if (name !== undefined) patch.name = String(name).trim();
  if (surname !== undefined) patch.surname = String(surname).trim();
  if (role !== undefined) patch.role = String(role).trim();
  if (active !== undefined) patch.is_active = active !== false;
  if (hourlyRate !== undefined) patch.hourlyRate = hourlyRate;
  if (employmentType !== undefined) patch.employmentType = String(employmentType).trim();

  const updated = await usersRepository.updateUser(id, patch);
  res.json(sanitizeUser(updated));
};

// DELETE /api/staff/:id – disattiva (soft)
exports.deleteStaff = async (req, res) => {
  const restaurantId = ensureOwner(req, res);
  if (!restaurantId) return;

  const id = req.params.id;
  const user = await usersRepository.findById(id);
  if (!user || user.restaurantId !== restaurantId) {
    return res.status(404).json({ error: "Utente non trovato." });
  }
  await usersRepository.updateUser(id, { is_active: false });
  res.json({ success: true });
};

// POST /api/staff/:id/reset-password – genera nuova password temporanea
exports.resetPassword = async (req, res) => {
  const restaurantId = ensureOwner(req, res);
  if (!restaurantId) return;

  const id = req.params.id;
  const user = await usersRepository.findById(id);
  if (!user || user.restaurantId !== restaurantId) {
    return res.status(404).json({ error: "Utente non trovato." });
  }

  const temporaryPassword = crypto.randomBytes(6).toString("base64").replace(/[+/=]/g, "").slice(0, 10);
  const hash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
  await usersRepository.setUserPassword(id, hash, { mustChangePassword: true });

  res.json({ ok: true, temporaryPassword });
};

// ——— Self-service (sessione = unico utente autorizzato) ———

exports.getMe = async (req, res) => {
  const sessionUser = req.session && req.session.user;
  if (!sessionUser || !sessionUser.id) {
    return res.status(401).json({ error: "Non autenticato." });
  }
  const user = await usersRepository.findById(sessionUser.id);
  if (!user || user.is_active === false) {
    return res.status(404).json({ error: "Utente non trovato." });
  }
  const staffRow = await loadStaffRowSafe(sessionUser.id);
  res.json(mergeUserWithStaffProfile(user, staffRow));
};

exports.patchMe = async (req, res) => {
  const sessionUser = req.session && req.session.user;
  if (!sessionUser || !sessionUser.id) {
    return res.status(401).json({ error: "Non autenticato." });
  }
  const user = await usersRepository.findById(sessionUser.id);
  if (!user || user.is_active === false) {
    return res.status(404).json({ error: "Utente non trovato." });
  }

  const body = req.body || {};
  const patch = {};
  const pNested = body.personal && typeof body.personal === "object" ? body.personal : null;
  const email = body.email !== undefined ? body.email : pNested && pNested.email;
  const phone = body.phone !== undefined ? body.phone : pNested && pNested.phone;
  const address = body.address !== undefined ? body.address : pNested && pNested.address;
  const name = body.name !== undefined ? body.name : pNested && pNested.name;
  const surname = body.surname !== undefined ? body.surname : pNested && pNested.surname;
  if (email !== undefined) patch.email = String(email).trim().slice(0, 255);
  if (phone !== undefined) patch.phone = String(phone).trim().slice(0, 64);
  if (address !== undefined) patch.address = String(address).trim().slice(0, 512);
  if (name !== undefined) patch.name = String(name).trim().slice(0, 255);
  if (surname !== undefined) patch.surname = String(surname).trim().slice(0, 255);

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: "Nessun campo modificabile inviato (email, telefono, indirizzo, nome, cognome)." });
  }

  await usersRepository.updateUser(sessionUser.id, patch);

  try {
    const existing = await staffRepository.getById(String(sessionUser.id));
    if (existing) {
      const pers = { ...(existing.personal || {}) };
      if (patch.email !== undefined) pers.email = patch.email;
      if (patch.phone !== undefined) pers.phone = patch.phone;
      if (patch.address !== undefined) pers.address = patch.address;
      if (patch.name !== undefined) pers.name = patch.name;
      if (patch.surname !== undefined) pers.surname = patch.surname;
      await staffRepository.update(String(sessionUser.id), { personal: pers });
    }
  } catch (_) {
    /* staff.json assente o id diverso: ok */
  }

  const fresh = await usersRepository.findById(sessionUser.id);
  const staffRow = await loadStaffRowSafe(sessionUser.id);
  res.json(mergeUserWithStaffProfile(fresh, staffRow));
};

exports.getMyShifts = async (req, res) => {
  const sessionUser = req.session && req.session.user;
  if (!sessionUser || !sessionUser.id) return res.status(401).json({ error: "Non autenticato." });
  const { dateFrom, dateTo, status } = req.query || {};
  const shifts = await shiftsRepository.getByStaffId(String(sessionUser.id), {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    status: status || undefined,
  });
  res.json(shifts);
};

exports.getMyShiftHistory = async (req, res) => {
  const sessionUser = req.session && req.session.user;
  if (!sessionUser || !sessionUser.id) return res.status(401).json({ error: "Non autenticato." });
  const { dateFrom, dateTo } = req.query || {};
  const uid = String(sessionUser.id);
  const history = await staffShiftsService.getShiftHistory(uid, dateFrom || "2000-01-01", dateTo || new Date().toISOString().slice(0, 10));
  res.json(history);
};

exports.getMyHoursSummary = async (req, res) => {
  const sessionUser = req.session && req.session.user;
  if (!sessionUser || !sessionUser.id) return res.status(401).json({ error: "Non autenticato." });
  const summary = await staffHoursService.getSummary(String(sessionUser.id));
  res.json(summary);
};

exports.getMyRequests = async (req, res) => {
  const sessionUser = req.session && req.session.user;
  if (!sessionUser || !sessionUser.id) return res.status(401).json({ error: "Non autenticato." });
  const requests = await staffRequestsService.getRequestsByStaff(String(sessionUser.id));
  res.json(requests);
};
