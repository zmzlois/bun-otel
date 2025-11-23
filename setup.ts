// setup.ts
import { readdirSync, copyFileSync, existsSync } from "fs";
import { join } from "path";

const rootEnv = ".env";
const workspaceDirs = ["package", "examples"];

if (!existsSync(rootEnv)) {
  console.error("No .env file found in root");
  process.exit(1);
}

console.log("Copying .env to workspace packages...\n");

for (const dir of workspaceDirs) {
  if (!existsSync(dir)) continue;

  const items = readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    if (item.isDirectory()) {
      const targetPath = join(dir, item.name, ".env");
      copyFileSync(rootEnv, targetPath);
      console.log(`✅ ${targetPath}`);
    }
  }
}

console.log("\n✨ Done!");
