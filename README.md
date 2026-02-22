# lang-tools-mcp

MCP (Model Context Protocol) server that provides tools to automate lint fixes and static analysis for Java and Kotlin code. Supports cleaning up unused imports and detecting dead code.

[![Tests](https://github.com/sickfar/lang-tools-mcp/actions/workflows/test.yml/badge.svg)](https://github.com/sickfar/lang-tools-mcp/actions/workflows/test.yml)

## Features

This MCP server provides six tools:

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

### 5. `detect_public_dead_code_java`
Cross-file detection of unused public and protected API in Java. Finds public/protected classes, methods, and fields that are never referenced across all analyzed files. Detection only — does not modify files.

**Input:**
- `paths`: Source root directories to scan recursively for `.java` files. Also used as resource roots for `META-INF/services` lookup when the `serviceDiscovery` entrypoint condition is active.
- `activeProfiles` *(optional)*: List of profile names to activate (built-in or user-defined). See [Configuration](#configuration).

**Output:**
```json
{
  "status": "OK",
  "sourceRoots": ["src/main/java"],
  "filesAnalyzed": 12,
  "activeProfiles": ["spring"],
  "totalFindings": 3,
  "files": [
    {
      "file": "src/main/java/com/example/OldHelper.java",
      "findings": [
        {
          "category": "unused_public_class",
          "name": "OldHelper",
          "line": 5,
          "column": 0,
          "enclosingScope": "OldHelper",
          "message": "public class 'OldHelper' in class OldHelper appears to be unused"
        }
      ]
    }
  ]
}
```

**Detects:**
- Unused public and protected classes, methods, and fields
- Cross-file: a declaration is considered used if it is referenced by name in any other analyzed file
- Profile-aware: entrypoints (e.g. Spring beans, JUnit tests) are excluded from findings
- Class cascade: if a class matches an entrypoint, all its members are kept alive

### 6. `detect_public_dead_code_kotlin`
Cross-file detection of unused public, internal, and protected API in Kotlin. Same behavior as the Java variant but for `.kt` files.

**Input:**
- `paths`: Source root directories to scan recursively for `.kt` files. Also used as resource roots for `META-INF/services` lookup when the `serviceDiscovery` entrypoint condition is active.
- `activeProfiles` *(optional)*: List of profile names to activate.

**Detects:**
- Unused public, internal, and protected classes, functions, and properties
- Top-level functions and properties
- Companion object members

## Configuration

`detect_public_dead_code_java` and `detect_public_dead_code_kotlin` support a profile system that lets you mark framework entry points as "alive" so they are not reported as dead code.

### Config file location

The server reads from the first found location:

1. `$LANG_TOOLS_CONFIG` environment variable (explicit path override)
2. `$XDG_CONFIG_HOME/lang-tools/config.json`
3. `~/.config/lang-tools/config.json` (default)

### Config format

```json
{
  "activeProfiles": ["spring", "junit5"],
  "profiles": [
    {
      "name": "my-framework",
      "keepExternalOverrides": true,
      "entrypoints": [
        {
          "name": "My annotation",
          "rules": [
            { "annotatedBy": "com.example.MyEntrypoint" }
          ]
        }
      ]
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `activeProfiles` | `string[]` | Profile names to apply. Can be built-in (`spring`, `junit5`, `android`, `micronaut`, `jakarta`) or user-defined in `profiles`. |
| `profiles` | `ProfileConfig[]` | User-defined profiles. These extend the built-in profiles. |

#### Profile fields

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Unique profile name. Referenced in `activeProfiles`. |
| `keepExternalOverrides` | `boolean` | When `false`, methods that override external (non-analyzed) APIs are also reported. Default: `true`. |
| `entrypoints` | `EntrypointConfig[]` | List of entrypoints. A declaration matching **any** entrypoint is considered alive. |

#### Entrypoint fields

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Human-readable label for this entrypoint (required, used in error messages). |
| `rules` | `ConditionConfig[]` | List of conditions. **All** conditions must match (AND logic). Must have at least one rule. |

#### Condition types

All conditions within one entrypoint are AND'd together. Conditions across different entrypoints are OR'd.

| Condition | Value | Matches when |
|---|---|---|
| `annotatedBy` | FQN string, e.g. `"org.springframework.stereotype.Component"` | The declaration has that annotation AND the file imports it (exact or wildcard). |
| `implementsInterfaceFromPackage` | Package glob, e.g. `"org.springframework.*"` | The class implements any interface imported from a matching package. |
| `implementsInterface` | FQN string, e.g. `"java.io.Serializable"` | The class implements the exact interface (resolved via import, exact or wildcard). |
| `extendsClassFromPackage` | Package glob, e.g. `"org.springframework.*"` | The class extends a class imported from a matching package. |
| `extendsClass` | FQN string, e.g. `"com.example.BaseController"` | The class extends the exact superclass (resolved via import, exact or wildcard). |
| `overridesMethodFromInterface` | Package glob | The method has `override`/`@Override` AND the enclosing class implements an interface from that package. |
| `namePattern` | Glob string, e.g. `"on*"` | The declaration name matches the glob (`*` = any chars, `?` = one char). |
| `packagePattern` | Glob string, e.g. `"com.example.api.*"` | The file's package declaration matches the glob. |
| `serviceDiscovery` | `true` | The class is registered in `META-INF/services`. |

> **Note on `implementsInterface` and `extendsClass`:** The internal AST representation does not always distinguish between implemented interfaces and extended classes (particularly in Kotlin where both appear as `delegation_specifier` nodes). These rule names are semantic hints for clarity — both rules perform the same import-resolved exact-FQN lookup.

> **Note on `annotatedBy` import resolution:** Package wildcards in import statements (e.g. `import org.springframework.*`) are treated as recursive prefix matches covering all sub-packages. This is a conservative approximation that avoids false positives at the cost of occasionally missing dead code when a very broad wildcard import is used.

### Built-in profiles

#### `spring`

Marks common Spring Framework entry points as alive.

| Entrypoint | Conditions (all must match) |
|---|---|
| Spring component (infrastructure bean) | `@Component` + implements interface from `org.springframework.*` |
| Spring service bean | `@Service` + implements interface from `org.springframework.*` |
| Spring configuration class | `@Configuration` |
| Spring bean producer method | `@Bean` |
| Spring web controller | `@Controller` |
| Spring REST controller | `@RestController` |
| Spring request mapping | `@RequestMapping` |
| Spring GET/POST/PUT/DELETE/PATCH mapping | `@GetMapping` / `@PostMapping` / etc. |
| Spring scheduled method | `@Scheduled` |
| Spring event listener | `@EventListener` |
| Spring injection point | `@Autowired` |
| Spring value injection | `@Value` |
| Spring config properties | `@ConfigurationProperties` |

> The compound rule for `@Component` and `@Service` means a class annotated with `@Component` alone (with no Spring interface) will still be reported as dead code. This is intentional — a bare `@Component` without a Spring interface is often an accidental annotation.

#### `junit5`

Marks JUnit 5 test methods as alive.

Covers: `@Test`, `@BeforeEach`, `@AfterEach`, `@BeforeAll`, `@AfterAll`, `@ParameterizedTest`, `@Suite`, `@Nested`, `@TestFactory`, `@RepeatedTest`, `@ExtendWith`, `@Tag`.

#### `android`

Marks Android lifecycle callbacks as alive via name pattern matching.

Covers: `onCreate`, `onStart`, `onResume`, `onPause`, `onStop`, `onDestroy`, `onCreateView`, `onViewCreated`, `onAttach`, `onDetach`, `onReceive`, `onBind`, `onUnbind`, `onRebind`, `onSaveInstanceState`, `onRestoreInstanceState`, `onActivityResult`, `onOptionsItemSelected`, `onCreateOptionsMenu`, `onRequestPermissionsResult`, `onBackPressed`.

#### `micronaut`

Marks Micronaut framework entry points as alive.

Covers: `@Singleton`, `@Inject`, `@Controller`, `@Get`, `@Post`, `@Put`, `@Delete`, `@Patch`, `@Options`, `@Head`, `@Filter`, `@Client`, `@Factory`, `@Bean`, `@Scheduled`, `@EventListener`, `@ConfigurationProperties`, `@ServerWebSocket`, `@ClientWebSocket`.

#### `jakarta`

Marks Jakarta EE entry points as alive.

Covers:
- **DI:** `@Singleton` (`jakarta.inject`), `@Inject`
- **CDI scopes:** `@ApplicationScoped`, `@RequestScoped`, `@SessionScoped`, `@Produces`
- **JAX-RS:** `@Path`, `@GET`, `@POST`, `@PUT`, `@DELETE`, `@PATCH`, `@HEAD`, `@OPTIONS`
- **EJB:** `@Stateless`, `@Stateful`, `@Singleton` (`jakarta.ejb`), `@Schedule`
- **JPA:** `@Entity`

### Example: Spring project

```json
{
  "activeProfiles": ["spring", "junit5"]
}
```

With this config, Spring beans, controllers, scheduled methods, and all JUnit 5 test methods are excluded from dead-code findings.

### Example: Custom entrypoint

```json
{
  "activeProfiles": ["spring", "junit5", "my-api"],
  "profiles": [
    {
      "name": "my-api",
      "entrypoints": [
        {
          "name": "Public API package",
          "rules": [{ "packagePattern": "com.example.api.*" }]
        },
        {
          "name": "Plugin entry point",
          "rules": [
            { "annotatedBy": "com.example.plugin.Plugin" },
            { "implementsInterfaceFromPackage": "com.example.plugin.*" }
          ]
        }
      ]
    }
  ]
}
```

### `activeProfiles` tool parameter vs config file

The `activeProfiles` parameter passed directly to the tool **replaces** (not extends) the `activeProfiles` from the config file. If you pass `activeProfiles: ["spring"]` in the tool call, the config file's `activeProfiles` is ignored. If you omit the parameter, the config file value is used.

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

Ask Claude to clean up imports or find dead code:

```
Clean up unused imports in src/main/java/com/example/
```

```
Find unused public methods in src/main/java using the spring and junit5 profiles
```

The server provides six tools:
- `cleanup_unused_imports_java` - Clean Java imports
- `cleanup_unused_imports_kotlin` - Clean Kotlin imports
- `detect_dead_code_java` - Detect unused private/local code in Java files
- `detect_dead_code_kotlin` - Detect unused private/local code in Kotlin files
- `detect_public_dead_code_java` - Cross-file detection of unused public API in Java
- `detect_public_dead_code_kotlin` - Cross-file detection of unused public API in Kotlin

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

### Dead Code Detection (private/local)

1. Parses source into AST
2. Runs four detectors: unused parameters, local variables, private fields, private methods
3. Uses scope-aware traversal to handle nested classes, companion objects, and lambdas correctly
4. Returns findings with file, line number, and context (method name, class name)

### Public Dead Code Detection (cross-file)

1. Parses all files into ASTs and collects all public/protected declarations
2. Collects all identifier references across all files into a global used-names set
3. Evaluates each declaration against active profile entrypoints (compound AND+OR logic)
4. Class cascade: any class matching an entrypoint keeps all its members alive
5. Reports declarations not referenced anywhere and not matched by any entrypoint

### Limitations

- Wildcard imports are always kept (safer approach)
- `detect_dead_code_*`: single-file scope only (no cross-file analysis)
- `detect_public_dead_code_*`: name-based reference matching — if two unrelated classes share the same name, referencing one keeps the other alive
- Annotation/interface matching is import-based (no type inference); annotations used without imports (same package) may not match `annotatedBy` conditions
- Overloaded methods with the same name: if any overload is referenced by name, all are considered used
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
