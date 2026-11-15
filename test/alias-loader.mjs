// Maps `@/lib/data` onto `<repo>/lib/data.ts`. Type-only imports are erased
// before this hook runs, so only runtime specifiers arrive here.
const root = new URL("../", import.meta.url)

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = new URL(`${specifier.slice(2)}.ts`, root)
    return nextResolve(target.href, context)
  }
  return nextResolve(specifier, context)
}
