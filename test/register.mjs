// Node's type stripper does not read tsconfig paths. App code imports `@/…`,
// so the test process registers a resolver before any test file loads.
import { register } from "node:module"

await register("./alias-loader.mjs", import.meta.url)
