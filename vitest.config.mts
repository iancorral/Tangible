import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Tests never reach a real database: every suite that needs Prisma mocks it.
    env: { DATABASE_URL: "mongodb://test.invalid/none" },
  },
});
