# lang-tools-mcp

MCP (Model Context Protocol) server that provides tools to automate lint fixes for Java and Kotlin code. Currently supports cleaning up unused imports.

[![Tests](https://github.com/sickfar/lang-tools-mcp/actions/workflows/test.yml/badge.svg)](https://github.com/sickfar/lang-tools-mcp/actions/workflows/test.yml)

## Features

This MCP server provides two tools:

### 1. `cleanup_unused_imports_java`
Cleans up unused imports in Java files using tree-sitter parsing.

**Input:**
- `files`: Array of Java file paths (absolute or relative)

**Output:**
```json
{
  "status": "OK",
  "filesProcessed": 5
}
```

**Behavior:**
- Removes specific unused imports
- Keeps wildcard imports (`import java.util.*`) for safety
- Preserves static imports that are used
- Handles both regular and static imports
- Considers annotations as used symbols

### 2. `cleanup_unused_imports_kotlin`
Cleans up unused imports in Kotlin files using tree-sitter parsing.

**Input:**
- `files`: Array of Kotlin file paths (absolute or relative)

**Output:**
```json
{
  "status": "OK",
  "filesProcessed": 3
}
```

**Behavior:**
- Removes specific unused imports
- Keeps wildcard imports (`import java.util.*`) for safety
- Handles import aliases (`import java.util.List as MyList`)
- Considers annotations as used symbols

## Installation

### Claude Code (Recommended)

```bash
claude mcp add lang-tools --scope user -- npx -y git+https://github.com/sickfar/lang-tools-mcp.git
```

Verify installation:
```bash
claude mcp list
```

<details>
<summary>Advanced options</summary>

**Local development:**
```bash
git clone https://github.com/sickfar/lang-tools-mcp.git
cd lang-tools-mcp
npm install && npm run build
claude mcp add lang-tools --scope user -- node build/index.js
```

**Uninstall:**
```bash
claude mcp remove lang-tools
```
</details>

### Claude Desktop

Add to your configuration file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "lang-tools": {
      "command": "npx",
      "args": ["-y", "git+https://github.com/sickfar/lang-tools-mcp.git"]
    }
  }
}
```

## Usage

Ask Claude to clean up imports:

```
Clean up unused imports in src/main/java/com/example/Main.java
```

The server provides two tools:
- `cleanup_unused_imports_java` - Clean Java imports
- `cleanup_unused_imports_kotlin` - Clean Kotlin imports

## Usage with Other MCP Clients

This server works with any MCP client. The basic usage is:

```bash
# Run the server
node /path/to/lang-tools-mcp/build/index.js

# Or via npx
npx -y git+https://github.com/sickfar/lang-tools-mcp.git
```

The server communicates via stdio and responds to MCP protocol messages.

## Development

### Prerequisites

- Node.js 20 or higher
- npm 9 or higher

### Setup

```bash
git clone https://github.com/sickfar/lang-tools-mcp.git
cd lang-tools-mcp
npm install
```

### Build

```bash
# Production build (optimized with esbuild)
npm run build

# Development build (TSC, preserves types)
npm run build:dev

# Type checking only
npm run typecheck
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

This opens the MCP Inspector UI for testing the server interactively.

## How It Works

The server uses [tree-sitter](https://tree-sitter.github.io/tree-sitter/) parsers for Java and Kotlin to:

1. Parse the source code into an abstract syntax tree (AST)
2. Extract all import declarations
3. Identify all symbols/identifiers used in the code
4. Compare imports against used symbols
5. Remove imports that are not referenced
6. Write the cleaned code back to the file

### Import Detection Rules

**Unused imports are removed when:**
- The imported class/symbol is never referenced in the code
- The import is not a wildcard import

**Imports are kept when:**
- They are wildcard imports (`.*`)
- The imported symbol is used anywhere in the code
- The symbol appears in type annotations
- The symbol is used in annotations (e.g., `@Override`, `@Test`)

### Limitations

- Wildcard imports are always kept (safer approach)
- JavaDoc references are not considered as usage
- May not detect usage in some edge cases (e.g., reflection)
- Files with syntax errors will be skipped

## Error Handling

If errors occur during processing:
- Files with syntax errors are skipped
- Non-existent files are reported in the error list
- Processing continues for remaining files
- Status returns "NOK" if any errors occurred

Example error response:
```json
{
  "status": "NOK",
  "filesProcessed": 2,
  "errors": [
    "File not found: missing.java",
    "Failed to process: broken.java"
  ]
}
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass (`npm test`)
5. Submit a pull request

## License

MIT
