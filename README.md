# lang-tools-mcp

MCP (Model Context Protocol) server that provides tools to automate lint fixes for Java and Kotlin code. Currently supports cleaning up unused imports.

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

```bash
npm install
npm run build
```

## Usage with MCP Clients

### Configuration for Claude Desktop

Add to your Claude Desktop configuration file:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

## Development

### Build
```bash
npm run build
```

### Watch Mode
```bash
npm run watch
```

### Testing with MCP Inspector
```bash
npm run inspector
```

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

## License

MIT
