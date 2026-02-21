import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// --- Types -------------------------------------------------------------------

export type ProfileRule =
  | { type: 'annotation'; annotations: string[] }
  | { type: 'namePattern'; patterns: string[] }
  | { type: 'interface'; interfaces: string[] }
  | { type: 'serviceDiscovery' };

export interface ProfileConfig {
  keepExternalOverrides?: boolean; // defaults to true
  rules: ProfileRule[];
}

export interface LangToolsConfig {
  activeProfiles?: string[];
  customProfiles?: Record<string, ProfileConfig>;
}

export interface ResolvedRules {
  keepExternalOverrides: boolean;
  annotationNames: Set<string>; // annotation names WITHOUT @ prefix
  namePatterns: RegExp[];       // compiled glob patterns
  interfaceNames: Set<string>;
  serviceDiscovery: boolean;
}

// --- Built-in profiles -------------------------------------------------------

const BUILT_IN_PROFILES: Record<string, ProfileConfig> = {
  spring: {
    rules: [
      {
        type: 'annotation',
        annotations: [
          'Component',
          'Service',
          'Repository',
          'Controller',
          'RestController',
          'Configuration',
          'Bean',
          'Scheduled',
          'EventListener',
          'RequestMapping',
          'GetMapping',
          'PostMapping',
          'PutMapping',
          'DeleteMapping',
          'PatchMapping',
          'Autowired',
          'Value',
          'ConfigurationProperties',
          'ConditionalOnProperty',
          'ConditionalOnMissingBean',
          'ConditionalOnBean',
        ],
      },
    ],
  },
  junit5: {
    rules: [
      {
        type: 'annotation',
        annotations: [
          'Test',
          'BeforeEach',
          'AfterEach',
          'BeforeAll',
          'AfterAll',
          'ParameterizedTest',
          'Suite',
          'Nested',
          'TestFactory',
          'RepeatedTest',
          'ExtendWith',
          'Tag',
        ],
      },
    ],
  },
  android: {
    rules: [
      {
        type: 'namePattern',
        patterns: [
          'onCreate',
          'onStart',
          'onResume',
          'onPause',
          'onStop',
          'onDestroy',
          'onCreateView',
          'onViewCreated',
          'onAttach',
          'onDetach',
          'onReceive',
          'onBind',
          'onUnbind',
          'onRebind',
          'onSaveInstanceState',
          'onRestoreInstanceState',
          'onActivityResult',
          'onOptionsItemSelected',
          'onCreateOptionsMenu',
          'onRequestPermissionsResult',
          'onBackPressed',
        ],
      },
    ],
  },
};

// --- Glob to RegExp conversion -----------------------------------------------

/**
 * Converts a glob pattern to a RegExp.
 * - `*` -> `.*` (zero or more chars, including `.` — not restricted like shell glob)
 * - `?` -> `.`  (exactly one char)
 * - Other regex special chars are escaped
 * - Result is anchored: `^...$`
 *
 * Intentionally matches `.` with `*` because this is used for method name patterns
 * (not path matching), where `.` is not a meaningful separator.
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

// --- Profile resolution ------------------------------------------------------

/**
 * Resolves a list of active profile names into a merged ResolvedRules object.
 * Throws if an unknown profile name is given.
 * annotation names with '@' prefix are normalized (stripped).
 */
export function resolveProfiles(
  activeProfiles: string[],
  config: LangToolsConfig
): ResolvedRules {
  const result: ResolvedRules = {
    keepExternalOverrides: true,
    annotationNames: new Set<string>(),
    namePatterns: [],
    interfaceNames: new Set<string>(),
    serviceDiscovery: false,
  };

  if (activeProfiles.length === 0) {
    return result;
  }

  const customProfiles = config.customProfiles ?? {};

  for (const profileName of activeProfiles) {
    const profileConfig: ProfileConfig | undefined =
      BUILT_IN_PROFILES[profileName] ?? customProfiles[profileName];

    if (profileConfig == null) {
      throw new Error(
        `Unknown profile: "${profileName}". Available built-in profiles: ${Object.keys(BUILT_IN_PROFILES).join(', ')}.`
      );
    }

    // Merge keepExternalOverrides: if any profile sets it to false, result is false
    if (profileConfig.keepExternalOverrides === false) {
      result.keepExternalOverrides = false;
    }

    for (const rule of profileConfig.rules) {
      if (rule.type === 'annotation') {
        if (rule.annotations.length === 0) {
          throw new Error(
            `Profile "${profileName}" has an annotation rule with empty annotations list.`
          );
        }
        for (const ann of rule.annotations) {
          // Normalize: strip leading '@'
          const normalized = ann.startsWith('@') ? ann.slice(1) : ann;
          result.annotationNames.add(normalized);
        }
      } else if (rule.type === 'namePattern') {
        for (const pattern of rule.patterns) {
          result.namePatterns.push(globToRegex(pattern));
        }
      } else if (rule.type === 'interface') {
        for (const iface of rule.interfaces) {
          result.interfaceNames.add(iface);
        }
      } else if (rule.type === 'serviceDiscovery') {
        result.serviceDiscovery = true;
      }
    }
  }

  return result;
}
