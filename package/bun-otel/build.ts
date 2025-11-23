#!/usr/bin/env bun
import { rmSync, existsSync, copyFileSync } from "fs";
import { spawn } from "child_process";

const distDir = "./dist";

// Clean dist directory
console.log("Cleaning dist directory...");
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true });
}

// Build ESM bundle
console.log("📦 Building ESM bundle...");
const esmResult = await Bun.build({
  entrypoints: ["./index.ts"],
  outdir: "./dist",
  format: "esm",
  target: "node",
  minify: false,
  sourcemap: "external",
  naming: {
    entry: "[dir]/index.js",
  },
  external: ["@opentelemetry/*"],
});

if (!esmResult.success) {
  console.error("❌ ESM build failed:");
  for (const log of esmResult.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log("✅ ESM bundle built successfully");

// Build CJS bundle
console.log("📦 Building CJS bundle...");
const cjsResult = await Bun.build({
  entrypoints: ["./index.ts"],
  outdir: "./dist",
  format: "cjs",
  target: "node",
  minify: false,
  sourcemap: "external",
  naming: {
    entry: "[dir]/index.cjs",
  },
  external: ["@opentelemetry/*"],
});

if (!cjsResult.success) {
  console.error("❌ CJS build failed:");
  for (const log of cjsResult.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log("✅ CJS bundle built successfully");

// Generate type declarations using tsc
console.log("📝 Generating type declarations...");
const tscProcess = spawn("tsc", [], {
  stdio: "inherit",
  shell: true,
});

await new Promise<void>((resolve, reject) => {
  tscProcess.on("close", (code) => {
    if (code === 0) {
      console.log("✅ Type declarations generated successfully");
      resolve();
    } else {
      console.error("❌ Type declaration generation failed");
      reject(new Error(`tsc exited with code ${code}`));
    }
  });

  tscProcess.on("error", (err) => {
    console.error("❌ Failed to spawn tsc:", err);
    reject(err);
  });
});

// Copy README.md and package.json to dist
console.log("📄 Copying README.md and preparing package.json...");
try {
  if (existsSync("../README.md")) {
    copyFileSync("../README.md", "./dist/README.md");
    console.log("✅ README.md copied");
  }

  // Read and modify package.json for dist publishing
  if (existsSync("./package.json")) {
    const pkg = JSON.parse(await Bun.file("./package.json").text());

    // Update paths to remove dist/ prefix since we're publishing from dist
    pkg.main = "./index.cjs";
    pkg.module = "./index.js";
    pkg.types = "./index.d.ts";

    if (pkg.exports) {
      pkg.exports["."] = {
        import: {
          types: "./index.d.ts",
          default: "./index.js",
        },
        require: {
          types: "./index.d.ts",
          default: "./index.cjs",
        },
      };
    }

    // Update files array to include root-level files
    pkg.files = ["*.js", "*.cjs", "*.d.ts", "*.map", "README.md"];

    // Write modified package.json to dist
    await Bun.write("./dist/package.json", JSON.stringify(pkg, null, 2));
    console.log("✅ package.json prepared for publishing");
  }
} catch (err) {
  console.error("⚠️  Failed to copy files:", err);
}

// Clean up tsbuildinfo files
console.log("🧹 Cleaning up tsbuildinfo files...");
try {
  if (existsSync("./dist/tsconfig.tsbuildinfo")) {
    rmSync("./dist/tsconfig.tsbuildinfo");
    console.log("✅ Removed tsconfig.tsbuildinfo");
  }
} catch (err) {
  console.error("⚠️  Failed to remove tsbuildinfo:", err);
}

console.log("\n🎉 Build complete!");
console.log("📂 Outputs:");
console.log("  - dist/index.js (ESM)");
console.log("  - dist/index.cjs (CommonJS)");
console.log("  - dist/index.d.ts (TypeScript declarations)");
console.log("  - dist/README.md");
console.log("  - dist/package.json");
