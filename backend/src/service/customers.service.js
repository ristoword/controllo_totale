const customersRepository = require("../repositories/customers.repository");
const { normalizeCategory } = require("../repositories/customers.repository.logic");

async function findOrCreate(data) {
  const phone = (data.phone || "").trim();
  const email = (data.email || "").trim();
  const name = (data.name || "").trim();
  const surname = (data.surname || "").trim();

  if (phone) {
    const byPhone = await customersRepository.findByPhone(phone);
    if (byPhone) return byPhone;
  }
  if (email) {
    const byEmail = await customersRepository.findByEmail(email);
    if (byEmail) return byEmail;
  }

  return customersRepository.create({
    name: name || "Cliente",
    surname: surname,
    phone,
    email,
    notes: (data.notes || "").trim(),
    category: "nuovo",
  });
}

async function list(filters = {}) {
  await customersRepository.seedIfEmpty();
  let items = await customersRepository.getAll();
  const cat = normalizeCategory(filters.category || "");
  const q = (filters.q || "").trim();

  if (q) {
    items = await customersRepository.searchByNameOrPhone(q);
  }
  if (filters.category) {
    items = items.filter((c) => c.category === cat);
  }

  return items.sort((a, b) => {
    const na = `${a.surname} ${a.name}`.toLowerCase();
    const nb = `${b.surname} ${b.name}`.toLowerCase();
    return na.localeCompare(nb);
  });
}

async function getById(id) {
  return customersRepository.getById(id);
}

async function create(data) {
  return customersRepository.create(data);
}

async function update(id, data) {
  return customersRepository.update(id, data);
}

async function remove(id) {
  return customersRepository.remove(id);
}

module.exports = {
  findOrCreate,
  list,
  getById,
  create,
  update,
  remove,
};
