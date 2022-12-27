import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  target: "node16",
  format: ["esm"],
  shims: false,
  dts: false,
});
