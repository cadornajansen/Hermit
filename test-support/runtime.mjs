import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import ts from "typescript"

const require = createRequire(import.meta.url)
const root = new URL("../", import.meta.url)
let serial = 0
export const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`

// Compile real application modules for Node, replacing only supplied boundaries.
export function loadRuntime(path, stubs = {}) {
  const cache = new Map()
  const instance = serial++
  function resolve(spec, parent) {
    if (stubs[spec]) return stubs[spec]
    if (spec.startsWith("node:")) return spec
    if (!spec.startsWith(".") && !spec.startsWith("@/")) return pathToFileURL(require.resolve(spec)).href
    let url = spec.startsWith("@/") ? new URL(spec.slice(2), root) : new URL(spec, parent)
    if (!/\.(ts|tsx|json)$/.test(url.pathname)) {
      try { readFileSync(new URL(`${url.href}.ts`)); url = new URL(`${url.href}.ts`) }
      catch { url = new URL(`${url.href}.tsx`) }
    }
    return compile(url)
  }
  function compile(url) {
    if (cache.has(url.href)) return cache.get(url.href)
    const raw = readFileSync(url, "utf8")
    const source = url.pathname.endsWith(".json") ? `export default ${raw}` : ts.transpileModule(raw, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText
    const code = source
      .replace(/from (["'])([^"']+)\1(?: with \{ type: ["']json["'] \})?/g, (_, _quote, spec) => `from ${JSON.stringify(resolve(spec, url))}`)
      .replace(/(^|\n)import (["'])([^"']+)\2;/g, (_, prefix, _quote, spec) => `${prefix}import ${JSON.stringify(resolve(spec, url))};`)
      .replace(/import\((["'])([^"']+)\1\)/g, (_, _quote, spec) => `import(${JSON.stringify(resolve(spec, url))})`)
    const result = dataModule(`${code}\n// runtime ${instance}`)
    cache.set(url.href, result)
    return result
  }
  return import(compile(new URL(path, root)))
}
