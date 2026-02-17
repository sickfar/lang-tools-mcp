# lang-tools-mcp

MCP (Model Context Protocol) server that provides tools to automate lint fixes and static analysis for Java and Kotlin code. Supports cleaning up unused imports and detecting dead code.

[![Tests](https://github.com/sickfar/lang-tools-mcp/actions/workflows/test.yml/badge.svg)](https://github.com/sickfar/lang-tools-mcp/actions/workflows/test.yml)

## Features

This MCP server provides four tools:

### 1. `cleanup_unused_imports_java`
Cleans up unused imports in Java files using tree-sitter parsing.

**Input:**
- `paths`: Array of Java file paths or directories (absolute or relative). Directories are scanned recursively for `.java` files.

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
- `paths`: Array of Kotlin file paths or directories (absolute or relative). Directories are scanned recursively for `.kt` files.

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

### 3. `detect_dead_code_java`
Detects dead code in Java files using tree-sitter parsing. Detection only — does not modify files.

**Input:**
- `paths`: Array of Java file paths or directories (absolute or relative). Directories are scanned recursively for `.java` files.

**Output:**
```json
{
  "status": "OK",
  "filesProcessed": 2,
  "findings": [
    {
      "file": "src/Main.java",
      "findings": [
        {
          "category": "unused-parameter",
          "name": "unusedParam",
          "line": 15,
          "method": "process",
          "className": "Main"
        }
      ]
    }
  ]
}
```

**Detects:**
- Unused method parameters (skips `main`, overrides, annotated params)
- Unused local variables
- Unused private fields (skips serialVersionUID, loggers)
- Unused private methods (skips annotated methods)
- Scope-aware: correctly handles inner classes, lambdas, anonymous classes

### 4. `detect_dead_code_kotlin`
Detects dead code in Kotlin files using tree-sitter parsing. Detection only — does not modify files.

**Input:**
- `paths`: Array of Kotlin file paths or directories (absolute or relative). Directories are scanned recursively for `.kt` files.

**Detects:**
- Unused function parameters (skips overrides, annotated params, primary constructors)
- Unused local variables (skips destructuring `_` placeholders)
- Unused private properties (skips loggers)
- Unused private functions
- Scope-aware: correctly handles inner classes, companion objects

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

Ask Claude to clean up imports in a file or directory:

```
Clean up unused imports in src/main/java/com/example/
```

The server provides four tools:
- `cleanup_unused_imports_java` - Clean Java imports
- `cleanup_unused_imports_kotlin` - Clean Kotlin imports
- `detect_dead_code_java` - Detect dead code in Java files
- `detect_dead_code_kotlin` - Detect dead code in Kotlin files

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

The server uses [tree-sitter](https://tree-sitter.github.io/tree-sitter/) parsers for Java and Kotlin to parse source code into an AST and perform analysis.

### Import Cleanup

1. Extracts all import declarations
2. Identifies all symbols/identifiers used in the code
3. Removes imports that are not referenced
4. Writes the cleaned code back to the file

### Dead Code Detection

1. Parses source into AST
2. Runs four detectors: unused parameters, local variables, private fields, private methods
3. Uses scope-aware traversal to handle nested classes, companion objects, and lambdas correctly
4. Returns findings with file, line number, and context (method name, class name)

### Limitations

- Wildcard imports are always kept (safer approach)
- Dead code detection is single-file only (no cross-file analysis)
- Overloaded methods with the same name: if any overload is called, all are considered used
- Files with syntax errors will be skipped

## Error Handling

If errors occur during processing:
- Files with syntax errors are skipped
- Non-existent files or directories are reported in the error list
- Processing continues for remaining files
- Status returns "NOK" if any errors occurred

Example error response:
```json
{
  "status": "NOK",
  "filesProcessed": 2,
  "errors": [
    "Path not found: missing.java",
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
