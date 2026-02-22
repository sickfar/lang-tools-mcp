import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// --- User-facing Config Types ---

export type ConditionConfig =
  | { annotatedBy: string }
  | { implementsInterfaceFromPackage: string }
  | { implementsInterface: string }
  | { extendsClassFromPackage: string }
  | { overridesMethodFromInterface: string }
  | { namePattern: string }
  | { packagePattern: string }
  | { serviceDiscovery: true };

export interface EntrypointConfig {
  name: string;
  rules: ConditionConfig[];
}

export interface ProfileConfig {
  name: string;
  keepExternalOverrides?: boolean;
  entrypoints: EntrypointConfig[];
}

export interface LangToolsConfig {
  activeProfiles?: string[];
  profiles?: ProfileConfig[];
}

// --- Resolved (compiled) Types ---

export type ResolvedCondition =
  | { type: 'annotatedBy'; fqn: string }
  | { type: 'implementsInterfaceFromPackage'; pattern: RegExp }
  | { type: 'implementsInterface'; fqn: string }
  | { type: 'extendsClassFromPackage'; pattern: RegExp }
  | { type: 'overridesMethodFromInterface'; pattern: RegExp }
  | { type: 'namePattern'; regex: RegExp }
  | { type: 'packagePattern'; regex: RegExp }
  | { type: 'serviceDiscovery' };

export interface ResolvedEntrypoint {
  name: string;
  conditions: ResolvedCondition[];
}

export interface ResolvedRules {
  keepExternalOverrides: boolean;
  entrypoints: ResolvedEntrypoint[];
}

// --- Built-in profiles -------------------------------------------------------

const BUILT_IN_PROFILES: ProfileConfig[] = [
  {
    name: 'spring',
    entrypoints: [
      {
        name: 'Spring component (infrastructure bean)',
        rules: [
          { annotatedBy: 'org.springframework.stereotype.Component' },
          { implementsInterfaceFromPackage: 'org.springframework.*' },
        ],
      },
      {
        name: 'Spring service bean',
        rules: [
          { annotatedBy: 'org.springframework.stereotype.Service' },
          { implementsInterfaceFromPackage: 'org.springframework.*' },
        ],
      },
      { name: 'Spring configuration class',  rules: [{ annotatedBy: 'org.springframework.context.annotation.Configuration' }] },
      { name: 'Spring bean producer method',  rules: [{ annotatedBy: 'org.springframework.context.annotation.Bean' }] },
      { name: 'Spring web controller',        rules: [{ annotatedBy: 'org.springframework.stereotype.Controller' }] },
      { name: 'Spring REST controller',       rules: [{ annotatedBy: 'org.springframework.web.bind.annotation.RestController' }] },
      { name: 'Spring request mapping',       rules: [{ annotatedBy: 'org.springframework.web.bind.annotation.RequestMapping' }] },
      { name: 'Spring GET mapping',           rules: [{ annotatedBy: 'org.springframework.web.bind.annotation.GetMapping' }] },
      { name: 'Spring POST mapping',          rules: [{ annotatedBy: 'org.springframework.web.bind.annotation.PostMapping' }] },
      { name: 'Spring PUT mapping',           rules: [{ annotatedBy: 'org.springframework.web.bind.annotation.PutMapping' }] },
      { name: 'Spring DELETE mapping',        rules: [{ annotatedBy: 'org.springframework.web.bind.annotation.DeleteMapping' }] },
      { name: 'Spring PATCH mapping',         rules: [{ annotatedBy: 'org.springframework.web.bind.annotation.PatchMapping' }] },
      { name: 'Spring scheduled method',      rules: [{ annotatedBy: 'org.springframework.scheduling.annotation.Scheduled' }] },
      { name: 'Spring event listener',        rules: [{ annotatedBy: 'org.springframework.context.event.EventListener' }] },
      { name: 'Spring injection point',       rules: [{ annotatedBy: 'org.springframework.beans.factory.annotation.Autowired' }] },
      { name: 'Spring value injection',       rules: [{ annotatedBy: 'org.springframework.beans.factory.annotation.Value' }] },
      { name: 'Spring config properties',     rules: [{ annotatedBy: 'org.springframework.boot.context.properties.ConfigurationProperties' }] },
    ],
  },
  {
    name: 'junit5',
    entrypoints: [
      { name: 'JUnit5 @Test',              rules: [{ annotatedBy: 'org.junit.jupiter.api.Test' }] },
      { name: 'JUnit5 @BeforeEach',        rules: [{ annotatedBy: 'org.junit.jupiter.api.BeforeEach' }] },
      { name: 'JUnit5 @AfterEach',         rules: [{ annotatedBy: 'org.junit.jupiter.api.AfterEach' }] },
      { name: 'JUnit5 @BeforeAll',         rules: [{ annotatedBy: 'org.junit.jupiter.api.BeforeAll' }] },
      { name: 'JUnit5 @AfterAll',          rules: [{ annotatedBy: 'org.junit.jupiter.api.AfterAll' }] },
      { name: 'JUnit5 @ParameterizedTest', rules: [{ annotatedBy: 'org.junit.jupiter.params.ParameterizedTest' }] },
      { name: 'JUnit5 @Suite',             rules: [{ annotatedBy: 'org.junit.platform.suite.api.Suite' }] },
      { name: 'JUnit5 @Nested',            rules: [{ annotatedBy: 'org.junit.jupiter.api.Nested' }] },
      { name: 'JUnit5 @TestFactory',       rules: [{ annotatedBy: 'org.junit.jupiter.api.TestFactory' }] },
      { name: 'JUnit5 @RepeatedTest',      rules: [{ annotatedBy: 'org.junit.jupiter.api.RepeatedTest' }] },
      { name: 'JUnit5 @ExtendWith',        rules: [{ annotatedBy: 'org.junit.jupiter.api.extension.ExtendWith' }] },
      { name: 'JUnit5 @Tag',               rules: [{ annotatedBy: 'org.junit.jupiter.api.Tag' }] },
    ],
  },
  {
    name: 'android',
    entrypoints: [
      { name: 'Android onCreate',                   rules: [{ namePattern: 'onCreate' }] },
      { name: 'Android onStart',                    rules: [{ namePattern: 'onStart' }] },
      { name: 'Android onResume',                   rules: [{ namePattern: 'onResume' }] },
      { name: 'Android onPause',                    rules: [{ namePattern: 'onPause' }] },
      { name: 'Android onStop',                     rules: [{ namePattern: 'onStop' }] },
      { name: 'Android onDestroy',                  rules: [{ namePattern: 'onDestroy' }] },
      { name: 'Android onCreateView',               rules: [{ namePattern: 'onCreateView' }] },
      { name: 'Android onViewCreated',              rules: [{ namePattern: 'onViewCreated' }] },
      { name: 'Android onAttach',                   rules: [{ namePattern: 'onAttach' }] },
      { name: 'Android onDetach',                   rules: [{ namePattern: 'onDetach' }] },
      { name: 'Android onReceive',                  rules: [{ namePattern: 'onReceive' }] },
      { name: 'Android onBind',                     rules: [{ namePattern: 'onBind' }] },
      { name: 'Android onUnbind',                   rules: [{ namePattern: 'onUnbind' }] },
      { name: 'Android onRebind',                   rules: [{ namePattern: 'onRebind' }] },
      { name: 'Android onSaveInstanceState',        rules: [{ namePattern: 'onSaveInstanceState' }] },
      { name: 'Android onRestoreInstanceState',     rules: [{ namePattern: 'onRestoreInstanceState' }] },
      { name: 'Android onActivityResult',           rules: [{ namePattern: 'onActivityResult' }] },
      { name: 'Android onOptionsItemSelected',      rules: [{ namePattern: 'onOptionsItemSelected' }] },
      { name: 'Android onCreateOptionsMenu',        rules: [{ namePattern: 'onCreateOptionsMenu' }] },
      { name: 'Android onRequestPermissionsResult', rules: [{ namePattern: 'onRequestPermissionsResult' }] },
      { name: 'Android onBackPressed',              rules: [{ namePattern: 'onBackPressed' }] },
    ],
  },
];

// --- Glob to RegExp conversion -----------------------------------------------

/**
 * Converts a glob pattern to a RegExp.
 * - `*` -> `.*` (zero or more chars, including `.` — not restricted like shell glob)
 * - `?` -> `.`  (exactly one char)
 * - Other regex special chars are escaped
 * - Result is anchored: `^...$`
 *
 * Intentionally matches `.` with `*` because this is used for method name patterns
 * and package patterns (where `.` separates segments but `*` should match across them).
 */
export function globToRegex(pattern: string): RegExp {
  const regexStr = pattern
    .split('')
    .map(char => {
      if (char === '*') return '.*';
      if (char === '?') return '.';
      if (/[.+^${}()|[\]\\]/.test(char)) return `\\${char}`;
      return char;
    })
    .join('');
  return new RegExp(`^${regexStr}$`);
}

// --- Config loading -----------------------------------------------------------

/**
 * Resolves the config file path:
 * 1. LANG_TOOLS_CONFIG env var (explicit override)
 * 2. $XDG_CONFIG_HOME/lang-tools/config.json
 * 3. ~/.config/lang-tools/config.json (fallback)
 */
function resolveConfigPath(): string {
  const envOverride = process.env.LANG_TOOLS_CONFIG;
  if (envOverride) return envOverride;

  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  const baseDir = xdgConfigHome != null ? xdgConfigHome : path.join(os.homedir(), '.config');
  return path.join(baseDir, 'lang-tools', 'config.json');
}

/**
 * Loads LangToolsConfig from the config file.
 * Returns an empty config if the file does not exist.
 * Throws a descriptive error for malformed JSON.
 */
export function loadConfig(): LangToolsConfig {
  const configPath = resolveConfigPath();

  if (fs.existsSync(configPath) === false) {
    return {};
  }

  let raw: string;
  try {
    raw = fs.readFileSync(configPath, 'utf-8');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read lang-tools config at "${configPath}": ${msg}`);
  }

  try {
    return JSON.parse(raw) as LangToolsConfig;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to parse lang-tools config at "${configPath}": malformed JSON — ${msg}`
    );
  }
}

// --- Profile merging ---------------------------------------------------------

/**
 * Merges active profiles: tool params REPLACE config's activeProfiles.
 * If toolActiveProfiles is undefined, falls back to config's activeProfiles.
 * Returns [] when neither is set.
 */
export function mergeActiveProfiles(
  config: LangToolsConfig,
  toolActiveProfiles?: string[]
): string[] {
  if (toolActiveProfiles !== undefined) {
    return toolActiveProfiles;
  }
  return config.activeProfiles ?? [];
}

// --- Import-based matching helpers ------------------------------------------

/**
 * Returns true when `importFQN` (from the file's import list) covers `annotationFQN`.
 * Supports exact imports and wildcard imports.
 *
 * NOTE: Wildcard imports (e.g. `org.springframework.*`) are treated as recursive prefix
 * matches covering all sub-packages, NOT just the direct package members as Java/Kotlin
 * actually resolves them. This is a deliberate conservative approximation that avoids
 * false positives (incorrectly marking live code as dead) at the cost of potential
 * false negatives (missing dead code where a broad wildcard happens to match).
 *
 * Examples:
 *   annotationFQN = "org.springframework.stereotype.Component"
 *   importFQN = "org.springframework.stereotype.Component"   → exact match → true
 *   importFQN = "org.springframework.stereotype.*"           → package wildcard → true
 *   importFQN = "org.springframework.*"                      → broader wildcard → true (sub-package matched)
 *   importFQN = "org.springframework.beans.*"                → sibling wildcard → false
 */
export function annotationMatchesImport(annotationFQN: string, importFQN: string): boolean {
  const lastDot = annotationFQN.lastIndexOf('.');
  if (lastDot === -1) return false;
  const exactPackage = annotationFQN.substring(0, lastDot);
  if (importFQN.endsWith('.*')) {
    const wildcardPackage = importFQN.slice(0, -2);
    return exactPackage === wildcardPackage || exactPackage.startsWith(wildcardPackage + '.');
  }
  return importFQN === annotationFQN;
}

/**
 * Returns true when `interfaceName` can be resolved to a type that comes from a package
 * matching `patternRegex`, based on the file's import list.
 *
 * Resolution strategy (no type inference — syntax only):
 * - Exact import `pkg.InterfaceName` → checks if `pkg.InterfaceName` matches pattern
 * - Wildcard import `pkg.*` → assumes `pkg.InterfaceName` might come from here; checks
 *   if `pkg.InterfaceName` matches the pattern
 */
export function interfaceIsFromPackage(
  interfaceName: string,
  patternRegex: RegExp,
  fileImports: string[],
): boolean {
  for (const imp of fileImports) {
    if (imp.endsWith('.*')) {
      const pkg = imp.slice(0, -2);
      if (patternRegex.test(pkg + '.' + interfaceName)) return true;
    } else {
      const lastDot = imp.lastIndexOf('.');
      if (lastDot === -1) continue;
      const importedName = imp.substring(lastDot + 1);
      if (importedName === interfaceName) {
        if (patternRegex.test(imp)) return true;
      }
    }
  }
  return false;
}

// --- Condition + Entrypoint resolution ---------------------------------------

function resolveCondition(cond: ConditionConfig): ResolvedCondition {
  if ('annotatedBy' in cond) {
    return { type: 'annotatedBy', fqn: cond.annotatedBy };
  }
  if ('implementsInterfaceFromPackage' in cond) {
    return { type: 'implementsInterfaceFromPackage', pattern: globToRegex(cond.implementsInterfaceFromPackage) };
  }
  if ('implementsInterface' in cond) {
    return { type: 'implementsInterface', fqn: cond.implementsInterface };
  }
  if ('extendsClassFromPackage' in cond) {
    return { type: 'extendsClassFromPackage', pattern: globToRegex(cond.extendsClassFromPackage) };
  }
  if ('overridesMethodFromInterface' in cond) {
    return { type: 'overridesMethodFromInterface', pattern: globToRegex(cond.overridesMethodFromInterface) };
  }
  if ('namePattern' in cond) {
    return { type: 'namePattern', regex: globToRegex(cond.namePattern) };
  }
  if ('packagePattern' in cond) {
    return { type: 'packagePattern', regex: globToRegex(cond.packagePattern) };
  }
  // serviceDiscovery: true
  return { type: 'serviceDiscovery' };
}

function resolveEntrypoint(ep: EntrypointConfig, profileName: string): ResolvedEntrypoint {
  if (!ep.name) {
    throw new Error(`Profile "${profileName}" has an entrypoint with missing or empty name.`);
  }
  if (ep.rules.length === 0) {
    throw new Error(
      `Profile "${profileName}", entrypoint "${ep.name}" has an empty rules array. ` +
      `An entrypoint must have at least one condition.`
    );
  }
  return {
    name: ep.name,
    conditions: ep.rules.map(c => resolveCondition(c)),
  };
}

// --- Profile resolution ------------------------------------------------------

/**
 * Resolves a list of active profile names into a merged ResolvedRules object.
 * Throws if an unknown profile name is given.
 * Multiple entrypoints from multiple profiles are flattened into one list (OR logic).
 * Within a single entrypoint, all conditions must match (AND logic).
 */
export function resolveProfiles(
  activeProfiles: string[],
  config: LangToolsConfig
): ResolvedRules {
  const result: ResolvedRules = {
    keepExternalOverrides: true,
    entrypoints: [],
  };

  if (activeProfiles.length === 0) {
    return result;
  }

  const builtInMap = new Map(BUILT_IN_PROFILES.map(p => [p.name, p]));
  const userProfiles = config.profiles ?? [];
  const userMap = new Map(userProfiles.map(p => [p.name, p]));

  for (const profileName of activeProfiles) {
    const profile: ProfileConfig | undefined = builtInMap.get(profileName) ?? userMap.get(profileName);

    if (profile == null) {
      throw new Error(
        `Unknown profile: "${profileName}". Available built-in profiles: ${[...builtInMap.keys()].join(', ')}.`
      );
    }

    if (profile.keepExternalOverrides === false) {
      result.keepExternalOverrides = false;
    }

    for (const ep of profile.entrypoints) {
      result.entrypoints.push(resolveEntrypoint(ep, profileName));
    }
  }

  return result;
}
