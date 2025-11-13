import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

type NodeRequire = typeof require;

type MutableModule = NodeJS.Module & {
  path?: string;
  children?: NodeJS.Module[];
  paths?: string[];
  require?: NodeRequire;
};

try {
  const resolved = require.resolve("server-only");
  if (!require.cache[resolved]) {
    const stub: Partial<MutableModule> = {
      id: resolved,
      filename: resolved,
      loaded: true,
      exports: {},
      require,
      path: resolved,
      children: [],
      paths: [],
    };

    require.cache[resolved] = stub as NodeJS.Module;
  }
} catch {
  // Module not found or resolution failed; nothing to shim.
}
