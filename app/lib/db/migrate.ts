import { closeDatabase, openDatabase, resolveDatabasePath } from "./connection.js";
import { runMigrations } from "./migrations.js";

const dbPath = resolveDatabasePath();
const db = openDatabase(dbPath);

try {
  const records = runMigrations(db);
  const applied = records.filter((record) => record.applied).map((record) => record.version);
  const skipped = records.filter((record) => !record.applied).map((record) => record.version);

  console.log(`Migrated SQLite database at ${dbPath}`);
  console.log(`Applied: ${applied.length > 0 ? applied.join(", ") : "none"}`);
  console.log(`Already current: ${skipped.length > 0 ? skipped.join(", ") : "none"}`);
} finally {
  closeDatabase(db);
}
