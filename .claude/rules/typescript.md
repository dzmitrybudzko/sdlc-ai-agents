---
globs: "**/*.ts"
---

# TypeScript Rules

## Module System
- Use ESM imports/exports exclusively: `import { x } from './module.js'`
- Include `.js` extension in relative imports (required for ESM)
- Never use `require()` or `module.exports`

## Type Safety
- Enable `strict: true` in all tsconfig files
- Never use `any` — use `unknown` and narrow with type guards, or define a proper interface
- Prefer `interface` for object shapes, `type` for unions and intersections
- Use `satisfies` operator for type-safe object literals: `const config = { ... } satisfies Config`
- Use `as const` for literal arrays and objects that shouldn't be widened

## Error Handling
- Define custom error classes extending `Error` for domain errors
- Always set `error.cause` when wrapping errors: `throw new AppError('msg', { cause: original })`
- Type catch variables as `unknown` and narrow: `catch (err) { if (err instanceof X) ... }`
- Never silently swallow errors — log or rethrow

## Naming Conventions
- `camelCase` for variables, functions, parameters
- `PascalCase` for types, interfaces, classes, enums
- `UPPER_SNAKE_CASE` for constants (module-level, immutable values only)
- `kebab-case` for file names: `user-service.ts`, `rate-limiter.ts`
- Prefix interfaces that describe a contract with `I` only if the project already uses this convention, otherwise don't

## Patterns
- Prefer `async/await` over raw Promise chains
- Use `readonly` for properties that shouldn't be reassigned after construction
- Prefer `Map` and `Set` over plain objects for dynamic key collections
- Use `using` / `Symbol.dispose` for resources that need cleanup (Node.js 20+)
