import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const directory = fileURLToPath(new URL(".", import.meta.url));

await build({
  absWorkingDir: directory,
  entryPoints: ["src/main.ts"],
  outfile: "main.js",
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  platform: "browser",
  target: "es2020",
});
