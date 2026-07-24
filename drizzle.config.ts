// Root-level drizzle config used by `npx drizzle-kit check` in CI.
// Delegates to the backend schema and migration output directory.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./backend/src/lib/db/schema.ts",
  out: "./backend/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgres://postgres:postgres@localhost:5432/zendvo",
  },
});
