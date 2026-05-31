const required = ["IKIS_SHARED_PASSWORD", "IKIS_AUTH_SECRET"];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(
    `Ikis cannot start because ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} missing. `
      + "Set IKIS_SHARED_PASSWORD and IKIS_AUTH_SECRET (generate the secret with `openssl rand -hex 32`) before starting.",
  );
  process.exit(1);
}
