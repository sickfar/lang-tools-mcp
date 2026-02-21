import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  loadConfig,
  mergeActiveProfiles,
  resolveProfiles,
  globToRegex,
  type LangToolsConfig,
} from '../src/profileConfig.js';

// Helper to write a config file in a temp dir
function writeTempConfig(dir: string, content: object | string): string {
  const configDir = path.join(dir, 'lang-tools');
  fs.mkdirSync(configDir, { recursive: true });
  const configPath = path.join(configDir, 'config.json');
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  fs.writeFileSync(configPath, text, 'utf-8');
  return configPath;
}

describe('loadConfig', () => {
  let tmpDir: string;
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lang-tools-test-'));
    // Snapshot relevant env vars
    savedEnv = {
      LANG_TOOLS_CONFIG: process.env.LANG_TOOLS_CONFIG,
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    };
    delete process.env.LANG_TOOLS_CONFIG;
    delete process.env.XDG_CONFIG_HOME;
  });

  afterEach(() => {
    // Restore env vars
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
    // Clean up temp dir
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('loads config from LANG_TOOLS_CONFIG env var path', () => {
    const configPath = writeTempConfig(tmpDir, { activeProfiles: ['spring'] });
    process.env.LANG_TOOLS_CONFIG = configPath;

    const config = loadConfig();
    expect(config.activeProfiles).toEqual(['spring']);
  });

  test('returns empty config when file does not exist (no error)', () => {
    process.env.LANG_TOOLS_CONFIG = path.join(tmpDir, 'nonexistent', 'config.json');

    const config = loadConfig();
    expect(config).toEqual({});
  });

  test('throws descriptive error for malformed JSON config', () => {
    const configDir = path.join(tmpDir, 'lang-tools');
    fs.mkdirSync(configDir, { recursive: true });
    const configPath = path.join(configDir, 'config.json');
    fs.writeFileSync(configPath, '{ invalid json }', 'utf-8');
    process.env.LANG_TOOLS_CONFIG = configPath;

    expect(() => loadConfig()).toThrow(/malformed|JSON|parse/i);
  });

  test('loads from XDG_CONFIG_HOME env var when set', () => {
    process.env.XDG_CONFIG_HOME = tmpDir;
    writeTempConfig(tmpDir, { activeProfiles: ['android'] });

    const config = loadConfig();
    expect(config.activeProfiles).toEqual(['android']);
  });

  test('returns empty config when XDG config file does not exist', () => {
    process.env.XDG_CONFIG_HOME = tmpDir;
    // No config file created

    const config = loadConfig();
    expect(config).toEqual({});
  });
});

describe('mergeActiveProfiles', () => {
  test('no config + no tool params returns []', () => {
    const config: LangToolsConfig = {};
    expect(mergeActiveProfiles(config, undefined)).toEqual([]);
  });

  test('config activeProfiles + no tool params returns config profiles', () => {
    const config: LangToolsConfig = { activeProfiles: ['spring'] };
    expect(mergeActiveProfiles(config, undefined)).toEqual(['spring']);
  });

  test('tool params REPLACE config activeProfiles (not merge)', () => {
    const config: LangToolsConfig = { activeProfiles: ['spring'] };
    expect(mergeActiveProfiles(config, ['junit5'])).toEqual(['junit5']);
  });

  test('empty tool params [] replaces config activeProfiles', () => {
    const config: LangToolsConfig = { activeProfiles: ['spring'] };
    expect(mergeActiveProfiles(config, [])).toEqual([]);
  });

  test('no config + tool params returns tool params', () => {
    const config: LangToolsConfig = {};
    expect(mergeActiveProfiles(config, ['spring', 'junit5'])).toEqual(['spring', 'junit5']);
  });
});

describe('resolveProfiles', () => {
  const emptyConfig: LangToolsConfig = {};

  test('no active profiles returns empty ResolvedRules with keepExternalOverrides: true', () => {
    const result = resolveProfiles([], emptyConfig);
    expect(result.keepExternalOverrides).toBe(true);
    expect(result.annotationNames.size).toBe(0);
    expect(result.namePatterns.length).toBe(0);
    expect(result.interfaceNames.size).toBe(0);
    expect(result.serviceDiscovery).toBe(false);
  });

  test('spring profile includes expected annotation names', () => {
    const result = resolveProfiles(['spring'], emptyConfig);
    expect(result.annotationNames.has('Service')).toBe(true);
    expect(result.annotationNames.has('Component')).toBe(true);
    expect(result.annotationNames.has('Bean')).toBe(true);
    expect(result.annotationNames.has('Autowired')).toBe(true);
    expect(result.annotationNames.has('GetMapping')).toBe(true);
    expect(result.annotationNames.has('RestController')).toBe(true);
    expect(result.annotationNames.has('Configuration')).toBe(true);
    expect(result.annotationNames.has('Repository')).toBe(true);
  });

  test('junit5 profile includes expected annotation names', () => {
    const result = resolveProfiles(['junit5'], emptyConfig);
    expect(result.annotationNames.has('Test')).toBe(true);
    expect(result.annotationNames.has('BeforeEach')).toBe(true);
    expect(result.annotationNames.has('AfterEach')).toBe(true);
    expect(result.annotationNames.has('ParameterizedTest')).toBe(true);
  });

  test('android profile includes namePatterns matching lifecycle methods', () => {
    const result = resolveProfiles(['android'], emptyConfig);
    const matchNames = (name: string) => result.namePatterns.some(r => r.test(name));
    expect(matchNames('onCreate')).toBe(true);
    expect(matchNames('onDestroy')).toBe(true);
    expect(matchNames('onResume')).toBe(true);
    expect(matchNames('onPause')).toBe(true);
  });

  test('spring + junit5 merged — both annotation sets combined', () => {
    const result = resolveProfiles(['spring', 'junit5'], emptyConfig);
    expect(result.annotationNames.has('Service')).toBe(true);
    expect(result.annotationNames.has('Test')).toBe(true);
    expect(result.annotationNames.has('BeforeEach')).toBe(true);
    expect(result.annotationNames.has('Bean')).toBe(true);
  });

  test('custom profile from config is accessible', () => {
    const config: LangToolsConfig = {
      customProfiles: {
        myProfile: {
          rules: [{ type: 'annotation', annotations: ['MyAnnotation'] }],
        },
      },
    };
    const result = resolveProfiles(['myProfile'], config);
    expect(result.annotationNames.has('MyAnnotation')).toBe(true);
  });

  test('unknown profile name throws with message including the unknown name', () => {
    expect(() => resolveProfiles(['unknownProfile'], emptyConfig)).toThrow(/unknownProfile/);
  });

  test('keepExternalOverrides not set in profile defaults to true', () => {
    const config: LangToolsConfig = {
      customProfiles: {
        myProfile: {
          rules: [{ type: 'annotation', annotations: ['MyAnnotation'] }],
        },
      },
    };
    const result = resolveProfiles(['myProfile'], config);
    expect(result.keepExternalOverrides).toBe(true);
  });

  test('keepExternalOverrides: false in profile returns false', () => {
    const config: LangToolsConfig = {
      customProfiles: {
        strictProfile: {
          keepExternalOverrides: false,
          rules: [{ type: 'annotation', annotations: ['MyAnnotation'] }],
        },
      },
    };
    const result = resolveProfiles(['strictProfile'], config);
    expect(result.keepExternalOverrides).toBe(false);
  });

  test('keepExternalOverrides: false in ANY profile causes result to be false', () => {
    const config: LangToolsConfig = {
      customProfiles: {
        strictProfile: {
          keepExternalOverrides: false,
          rules: [{ type: 'annotation', annotations: ['MyAnnotation'] }],
        },
        permissiveProfile: {
          keepExternalOverrides: true,
          rules: [{ type: 'annotation', annotations: ['OtherAnnotation'] }],
        },
      },
    };
    const result = resolveProfiles(['strictProfile', 'permissiveProfile'], config);
    expect(result.keepExternalOverrides).toBe(false);
  });

  test('annotations with @ prefix are normalized (@ stripped)', () => {
    const config: LangToolsConfig = {
      customProfiles: {
        myProfile: {
          rules: [{ type: 'annotation', annotations: ['@MyAnnotation', '@AnotherAnnotation'] }],
        },
      },
    };
    const result = resolveProfiles(['myProfile'], config);
    expect(result.annotationNames.has('MyAnnotation')).toBe(true);
    expect(result.annotationNames.has('AnotherAnnotation')).toBe(true);
    expect(result.annotationNames.has('@MyAnnotation')).toBe(false);
  });

  test('serviceDiscovery rule sets serviceDiscovery: true', () => {
    const config: LangToolsConfig = {
      customProfiles: {
        myProfile: {
          rules: [{ type: 'serviceDiscovery' }],
        },
      },
    };
    const result = resolveProfiles(['myProfile'], config);
    expect(result.serviceDiscovery).toBe(true);
  });

  test('annotation rule with empty annotations throws error mentioning "empty"', () => {
    const config: LangToolsConfig = {
      customProfiles: {
        badProfile: {
          rules: [{ type: 'annotation', annotations: [] }],
        },
      },
    };
    expect(() => resolveProfiles(['badProfile'], config)).toThrow(/empty/i);
  });

  test('built-in profiles spring, junit5, android are always available without custom config', () => {
    expect(() => resolveProfiles(['spring'], emptyConfig)).not.toThrow();
    expect(() => resolveProfiles(['junit5'], emptyConfig)).not.toThrow();
    expect(() => resolveProfiles(['android'], emptyConfig)).not.toThrow();
  });
});

describe('globToRegex', () => {
  test('get* matches getName and getId but not fetchData', () => {
    const regex = globToRegex('get*');
    expect(regex.test('getName')).toBe(true);
    expect(regex.test('getId')).toBe(true);
    expect(regex.test('fetchData')).toBe(false);
    expect(regex.test('get')).toBe(true); // zero or more chars
  });

  test('get? matches getX but not getName (single char)', () => {
    const regex = globToRegex('get?');
    expect(regex.test('getX')).toBe(true);
    expect(regex.test('getName')).toBe(false);
    expect(regex.test('get')).toBe(false);
  });

  test('* matches anything', () => {
    const regex = globToRegex('*');
    expect(regex.test('anything')).toBe(true);
    expect(regex.test('')).toBe(true);
    expect(regex.test('getName')).toBe(true);
  });

  test('exact pattern fetchData matches only fetchData, not fetchDataExtra', () => {
    const regex = globToRegex('fetchData');
    expect(regex.test('fetchData')).toBe(true);
    expect(regex.test('fetchDataExtra')).toBe(false);
    expect(regex.test('prefetchData')).toBe(false);
  });

  test('pattern with special regex chars is escaped correctly', () => {
    const regex = globToRegex('get(Name)');
    expect(regex.test('get(Name)')).toBe(true);
    expect(regex.test('getName')).toBe(false);
  });
});
