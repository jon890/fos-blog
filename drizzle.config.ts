import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/infra/db/schema",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
