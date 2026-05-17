// Shared ESM resolver hook for the `verify-*.ts` harnesses (currently
// `verify-study-copy.ts` and `verify-provider-url-resolution.ts`). Not part of
// CI. Maps `@/*` aliases, stubs `server-only`, and inlines JSON imports so the
// TypeScript files can run under plain Node ESM after tsc compilation.

import { fileURLToPath, pathToFileURL } from "node:url"
import { existsSync, readFileSync } from "node:fs"
import { resolve as pathResolve, dirname } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const outDir = pathResolve(here, ".verify-out")

export function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export {};", shortCircuit: true, format: "module" }
  }
  if (specifier.startsWith("@/")) {
    const candidates = [
      `${specifier.slice(2)}.js`,
      `${specifier.slice(2)}/index.js`,
      specifier.slice(2),
    ]
    for (const candidate of candidates) {
      const absolute = pathResolve(outDir, candidate)
      if (existsSync(absolute)) {
        return nextResolve(pathToFileURL(absolute).href, context)
      }
    }
  }
  return nextResolve(specifier, context)
}

export function load(url, context, nextLoad) {
  if (url.endsWith(".json")) {
    const path = fileURLToPath(url)
    const source = `export default ${readFileSync(path, "utf8")}`
    return { format: "module", source, shortCircuit: true }
  }
  return nextLoad(url, context)
}
