# lang-tools-mcp

MCP server providing Java/Kotlin static analysis tools using tree-sitter AST parsing.

## Project Structure

- `src/index.ts` — MCP server entry point, tool registration and request handling
- `src/deadCodeDetector.ts` — Dead code detection logic (unused params, locals, fields, private methods)
- `__tests__/` — Jest tests (ESM mode via ts-jest)
- `__tests__/fixtures/` — Java and Kotlin fixture files for tests
- `build/` — Production bundle (esbuild, single file)

## Tech Stack

- TypeScript (ESM modules — use `.js` extensions in imports)
- tree-sitter + tree-sitter-java + tree-sitter-kotlin for AST parsing
- @modelcontextprotocol/sdk for MCP server
- Jest with ts-jest ESM preset
- esbuild for production bundling

## Commands

- `npm test` — run all tests
- `npm run typecheck` — type check without emitting
- `npm run build` — production build with esbuild
- `npm run build:dev` — development build with tsc

## Key Patterns

- `LanguageConfig` interface abstracts Java/Kotlin AST node type differences
- `isInSameClassScope()` helper prevents scope leaks across nested class boundaries
- `collectClassScopes()` finds both class declarations and Kotlin companion objects
- `findNameNode()` handles difference between Java (named field) and Kotlin (child node) name resolution
- Dead code detection is read-only — never modifies source files
- Single-file scope only — no cross-file analysis

## Constraints

- Detection tools must never modify source files
- Keep wildcard imports (safer approach)
- Skip files with syntax errors gracefully
- ESM module system — all imports use `.js` extension
