/**
 * Nome database MySQL usato come fallback quando non è impostato
 * MYSQLDATABASE / MYSQL_DATABASE / path in DATABASE_URL.
 *
 * Ogni deploy di Controllo Totale deve usare un database dedicato (vuoto,
 * creato per questo sito). Non puntare mai a un database di altri prodotti
 * o ambienti legacy.
 */
module.exports = {
  DEFAULT_MYSQL_DATABASE: "controllo_totale",
};
