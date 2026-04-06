-- ============================================================================
-- Controllo Totale — Estensioni schema (bozza evolutiva)
-- Da applicare dopo review su ambiente di staging; prefissare con migrazioni idempotenti.
-- Tutte le tabelle includono restaurant_id per multi-tenant.
-- ============================================================================

-- Fornitori (anagrafica)
CREATE TABLE IF NOT EXISTS suppliers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  vat_id VARCHAR(64) NULL,
  phone VARCHAR(64) NULL,
  email VARCHAR(255) NULL,
  address TEXT NULL,
  notes TEXT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_suppliers_restaurant (restaurant_id),
  KEY idx_suppliers_name (restaurant_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ricezioni merce (lotto in ingresso)
CREATE TABLE IF NOT EXISTS stock_receipts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id VARCHAR(64) NOT NULL,
  supplier_id BIGINT UNSIGNED NULL,
  receipt_date DATE NOT NULL,
  document_ref VARCHAR(128) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_receipts_restaurant (restaurant_id),
  KEY idx_receipts_date (restaurant_id, receipt_date),
  CONSTRAINT fk_receipt_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dipendenti (HR core)
CREATE TABLE IF NOT EXISTS employees (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id VARCHAR(64) NOT NULL,
  external_code VARCHAR(64) NULL,
  first_name VARCHAR(128) NOT NULL,
  last_name VARCHAR(128) NOT NULL,
  fiscal_code VARCHAR(32) NULL,
  birth_date DATE NULL,
  hire_date DATE NULL,
  end_date DATE NULL,
  role_title VARCHAR(128) NULL,
  department VARCHAR(64) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(64) NULL,
  address TEXT NULL,
  iban VARCHAR(64) NULL,
  base_salary_cents BIGINT NULL,
  notes TEXT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_emp_restaurant (restaurant_id),
  KEY idx_emp_name (restaurant_id, last_name, first_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Presenze / timbrature
CREATE TABLE IF NOT EXISTS attendance_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id VARCHAR(64) NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  event_type ENUM('in','out','break_start','break_end') NOT NULL,
  at_utc DATETIME NOT NULL,
  source VARCHAR(32) NULL DEFAULT 'manual',
  notes VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_att_rest_emp (restaurant_id, employee_id, at_utc),
  CONSTRAINT fk_att_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Richieste ferie / permessi / malattia (workflow)
CREATE TABLE IF NOT EXISTS leave_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id VARCHAR(64) NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  request_type ENUM('vacation','leave','sick','rest') NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  days_decimal DECIMAL(5,2) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_leave_rest (restaurant_id, employee_id),
  CONSTRAINT fk_leave_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pagamenti / premi / buoni (semplificato)
CREATE TABLE IF NOT EXISTS payroll_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id VARCHAR(64) NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  period_month CHAR(7) NOT NULL,
  amount_cents BIGINT NOT NULL,
  entry_type ENUM('salary','bonus','voucher','deduction','other') NOT NULL,
  paid_at DATE NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pay_rest_emp (restaurant_id, employee_id, period_month),
  CONSTRAINT fk_pay_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
