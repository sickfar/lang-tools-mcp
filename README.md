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

### Option 1: Install from GitHub (Recommended)

**Using npx (recommended for Claude Desktop):**

No installation needed! The server is automatically downloaded and cached when first used.

**Using npm global install:**

```bash
npm install -g git+https://github.com/sickfar/lang-tools-mcp.git
```

### Option 2: Clone and Build Locally

```bash
git clone https://github.com/sickfar/lang-tools-mcp.git
cd lang-tools-mcp
npm install
npm run build
```

## Usage with Claude Desktop

### Configuration

Add to your Claude Desktop configuration file:

- **MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

**Using npx (recommended):**

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

**Using global installation:**

```json
{
  "mcpServers": {
    "lang-tools": {
      "command": "lang-tools-mcp"
    }
  }
}
```

**Using local build:**

```json
{
  "mcpServers": {
    "lang-tools": {
      "command": "node",
      "args": ["/absolute/path/to/lang-tools-mcp/build/index.js"]
    }
  }
}
```

### Using the Tools

Once configured, you can use the tools in Claude Desktop:

**Example 1: Clean up Java imports**
```
Please use the cleanup_unused_imports_java tool to clean up imports in these files:
- src/main/java/com/example/Main.java
- src/main/java/com/example/Utils.java
```

**Example 2: Clean up Kotlin imports**
```
Use cleanup_unused_imports_kotlin to clean imports in:
- src/main/kotlin/com/example/App.kt
```

**Example 3: Batch cleanup**
```
Clean up all unused imports in my Java project under src/main/java/
```

## Installation with Claude Code CLI

If you're using Claude Code (CLI), you can add this MCP server using the `claude mcp add` command:

### Quick Installation

```bash
claude mcp add lang-tools --scope user -- npx -y git+https://github.com/sickfar/lang-tools-mcp.git
```

This command:
- Registers the server as "lang-tools"
- Makes it available across all projects (`--scope user`)
- Uses npx to automatically download and run the latest version
- Stores configuration in `~/.claude.json`

### Installation Options

**Option 1: Direct Installation (Recommended)**
```bash
claude mcp add lang-tools --scope user -- npx -y git+https://github.com/sickfar/lang-tools-mcp.git
```

**Option 2: Local Development Setup**
```bash
# Clone and build locally
git clone https://github.com/sickfar/lang-tools-mcp.git
cd lang-tools-mcp
npm install
npm run build

# Add to Claude Code
claude mcp add lang-tools --scope user -- node build/index.js
```

**Option 3: Project-Specific Installation**
```bash
# Add only for current project (stored in .claude/mcp.json)
claude mcp add lang-tools --scope local -- npx -y git+https://github.com/sickfar/lang-tools-mcp.git
```

### Verification

After installation, verify the server is registered:

```bash
# List all configured MCP servers
claude mcp list

# Get details of the lang-tools server
claude mcp get lang-tools

# Test the server connection
claude mcp test lang-tools
```

### Configuration Scopes

The `--scope` flag determines where the configuration is stored:

- **`--scope user`**: Available across all projects (`~/.claude.json`)
- **`--scope project`**: Available for the current project (`.mcp.json` in project root)
- **`--scope local`** (default): Project-local only (`.claude/mcp.json`)

### Uninstalling

To remove the server:

```bash
claude mcp remove lang-tools
```

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

### Watch Mode

```bash
npm run watch
```

### Testing with MCP Inspector

```bash
npm run inspector
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

## Architecture

```
lang-tools-mcp/
├── src/
│   ├── index.ts           # MCP server implementation
│   └── importCleaner.ts   # Core import cleanup logic
├── __tests__/
│   ├── java.test.ts       # Java import cleanup tests
│   ├── kotlin.test.ts     # Kotlin import cleanup tests
│   └── fixtures/          # Test fixtures
├── build/                 # Compiled output (generated)
└── package.json
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

## Changelog

### v0.1.0 (2026-01-11)
- Initial release
- Support for cleaning unused Java imports
- Support for cleaning unused Kotlin imports
- Tree-sitter based AST parsing
- Comprehensive test suite (27 tests)
- esbuild optimization for fast builds
