-- Esegui su DB MySQL esistenti creati prima dell’aggiunta di phone/address su users.
ALTER TABLE users ADD COLUMN phone VARCHAR(64) NULL AFTER email;
ALTER TABLE users ADD COLUMN address VARCHAR(512) NULL AFTER phone;
