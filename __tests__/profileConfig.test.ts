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
    savedEnv = {
      LANG_TOOLS_CONFIG: process.env.LANG_TOOLS_CONFIG,
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    };
    delete process.env.LANG_TOOLS_CONFIG;
    delete process.env.XDG_CONFIG_HOME;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
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
    expect(result.entrypoints).toEqual([]);
  });

  test('spring profile has entrypoints', () => {
    const result = resolveProfiles(['spring'], emptyConfig);
    expect(result.entrypoints.length).toBeGreaterThan(0);
  });

  test('spring profile has compound entrypoint with annotatedBy + implementsInterfaceFromPackage', () => {
    const result = resolveProfiles(['spring'], emptyConfig);
    const compound = result.entrypoints.find(ep =>
      ep.conditions.some(c => c.type === 'annotatedBy' && 'fqn' in c && c.fqn === 'org.springframework.stereotype.Component') &&
      ep.conditions.some(c => c.type === 'implementsInterfaceFromPackage')
    );
    expect(compound).toBeDefined();
    expect(compound!.conditions.length).toBe(2);
  });

  test('spring profile has single-condition @Bean entrypoint', () => {
    const result = resolveProfiles(['spring'], emptyConfig);
    const beanEp = result.entrypoints.find(ep =>
      ep.conditions.length === 1 &&
      ep.conditions[0].type === 'annotatedBy' &&
      'fqn' in ep.conditions[0] &&
      ep.conditions[0].fqn === 'org.springframework.context.annotation.Bean'
    );
    expect(beanEp).toBeDefined();
  });

  test('annotatedBy condition compiles to { type, fqn }', () => {
    const config: LangToolsConfig = {
      profiles: [{
        name: 'myProfile',
        entrypoints: [{ name: 'my annotation', rules: [{ annotatedBy: 'com.example.MyAnnotation' }] }],
      }],
    };
    const result = resolveProfiles(['myProfile'], config);
    expect(result.entrypoints[0].conditions[0]).toEqual({ type: 'annotatedBy', fqn: 'com.example.MyAnnotation' });
  });

  test('namePattern condition compiles to { type, regex }', () => {
    const config: LangToolsConfig = {
      profiles: [{
        name: 'myProfile',
        entrypoints: [{ name: 'get* pattern', rules: [{ namePattern: 'get*' }] }],
      }],
    };
    const result = resolveProfiles(['myProfile'], config);
    const cond = result.entrypoints[0].conditions[0];
    expect(cond.type).toBe('namePattern');
    expect('regex' in cond && cond.regex.test('getName')).toBe(true);
    expect('regex' in cond && cond.regex.test('fetchData')).toBe(false);
  });

  test('implementsInterfaceFromPackage compiles to { type, pattern }', () => {
    const config: LangToolsConfig = {
      profiles: [{
        name: 'myProfile',
        entrypoints: [{ name: 'spring if', rules: [{ implementsInterfaceFromPackage: 'org.springframework.*' }] }],
      }],
    };
    const result = resolveProfiles(['myProfile'], config);
    const cond = result.entrypoints[0].conditions[0];
    expect(cond.type).toBe('implementsInterfaceFromPackage');
    expect('pattern' in cond && cond.pattern.test('org.springframework.boot.Runner')).toBe(true);
    expect('pattern' in cond && cond.pattern.test('com.example.Foo')).toBe(false);
  });

  test('interfaces condition compiles to { type, name }', () => {
    const config: LangToolsConfig = {
      profiles: [{
        name: 'myProfile',
        entrypoints: [{ name: 'Serializable', rules: [{ interfaces: 'Serializable' }] }],
      }],
    };
    const result = resolveProfiles(['myProfile'], config);
    expect(result.entrypoints[0].conditions[0]).toEqual({ type: 'interfaces', name: 'Serializable' });
  });

  test('serviceDiscovery condition compiles to { type: "serviceDiscovery" }', () => {
    const config: LangToolsConfig = {
      profiles: [{
        name: 'myProfile',
        entrypoints: [{ name: 'service discovery', rules: [{ serviceDiscovery: true }] }],
      }],
    };
    const result = resolveProfiles(['myProfile'], config);
    expect(result.entrypoints[0].conditions[0]).toEqual({ type: 'serviceDiscovery' });
  });

  test('android profile has entrypoints matching lifecycle methods via namePattern', () => {
    const result = resolveProfiles(['android'], emptyConfig);
    const matchName = (name: string) => result.entrypoints.some(ep =>
      ep.conditions.some(c => c.type === 'namePattern' && 'regex' in c && c.regex.test(name))
    );
    expect(matchName('onCreate')).toBe(true);
    expect(matchName('onDestroy')).toBe(true);
    expect(matchName('onResume')).toBe(true);
    expect(matchName('onPause')).toBe(true);
  });

  test('junit5 profile has @Test, @BeforeEach, @AfterEach entrypoints', () => {
    const result = resolveProfiles(['junit5'], emptyConfig);
    const hasAnnotation = (fqn: string) => result.entrypoints.some(ep =>
      ep.conditions.some(c => c.type === 'annotatedBy' && 'fqn' in c && c.fqn === fqn)
    );
    expect(hasAnnotation('org.junit.jupiter.api.Test')).toBe(true);
    expect(hasAnnotation('org.junit.jupiter.api.BeforeEach')).toBe(true);
    expect(hasAnnotation('org.junit.jupiter.api.AfterEach')).toBe(true);
    expect(hasAnnotation('org.junit.jupiter.params.ParameterizedTest')).toBe(true);
  });

  test('spring + android merged - entrypoints combined from both profiles', () => {
    const result = resolveProfiles(['spring', 'android'], emptyConfig);
    const hasAnnotationType = result.entrypoints.some(ep => ep.conditions.some(c => c.type === 'annotatedBy'));
    const hasNamePatternType = result.entrypoints.some(ep => ep.conditions.some(c => c.type === 'namePattern'));
    expect(hasAnnotationType).toBe(true);
    expect(hasNamePatternType).toBe(true);
  });

  test('user profile from config profiles array is accessible', () => {
    const config: LangToolsConfig = {
      profiles: [{
        name: 'myProfile',
        entrypoints: [{ name: 'my annotation', rules: [{ annotatedBy: 'com.example.MyAnnotation' }] }],
      }],
    };
    const result = resolveProfiles(['myProfile'], config);
    expect(result.entrypoints.length).toBe(1);
    expect(result.entrypoints[0].conditions[0]).toMatchObject({ type: 'annotatedBy', fqn: 'com.example.MyAnnotation' });
  });

  test('unknown profile name throws with message including the unknown name', () => {
    expect(() => resolveProfiles(['unknownProfile'], emptyConfig)).toThrow(/unknownProfile/);
  });

  test('keepExternalOverrides not set defaults to true', () => {
    const config: LangToolsConfig = {
      profiles: [{
        name: 'myProfile',
        entrypoints: [{ name: 'my annotation', rules: [{ annotatedBy: 'com.example.MyAnnotation' }] }],
      }],
    };
    const result = resolveProfiles(['myProfile'], config);
    expect(result.keepExternalOverrides).toBe(true);
  });

  test('keepExternalOverrides: false in profile returns false', () => {
    const config: LangToolsConfig = {
      profiles: [{ name: 'strict', keepExternalOverrides: false, entrypoints: [] }],
    };
    const result = resolveProfiles(['strict'], config);
    expect(result.keepExternalOverrides).toBe(false);
  });

  test('keepExternalOverrides: false in ANY profile causes result to be false', () => {
    const config: LangToolsConfig = {
      profiles: [
        { name: 'strict', keepExternalOverrides: false, entrypoints: [] },
        { name: 'permissive', keepExternalOverrides: true, entrypoints: [] },
      ],
    };
    const result = resolveProfiles(['strict', 'permissive'], config);
    expect(result.keepExternalOverrides).toBe(false);
  });

  test('built-in profiles spring, junit5, android are always available without user config', () => {
    expect(() => resolveProfiles(['spring'], emptyConfig)).not.toThrow();
    expect(() => resolveProfiles(['junit5'], emptyConfig)).not.toThrow();
    expect(() => resolveProfiles(['android'], emptyConfig)).not.toThrow();
  });

  test('entrypoint with empty name throws a descriptive error', () => {
    const config: LangToolsConfig = {
      profiles: [{
        name: 'badProfile',
        entrypoints: [{ name: '', rules: [{ annotatedBy: 'com.example.X' }] }],
      }],
    };
    expect(() => resolveProfiles(['badProfile'], config)).toThrow(/badProfile/);
  });

  test('entrypoint with empty rules array throws a descriptive error', () => {
    const config: LangToolsConfig = {
      profiles: [{
        name: 'emptyRules',
        entrypoints: [{ name: 'catch-all', rules: [] }],
      }],
    };
    expect(() => resolveProfiles(['emptyRules'], config)).toThrow(/emptyRules/);
    expect(() => resolveProfiles(['emptyRules'], config)).toThrow(/catch-all/);
  });

  test('multiple entrypoints in one profile are all flattened', () => {
    const config: LangToolsConfig = {
      profiles: [{
        name: 'multi',
        entrypoints: [
          { name: 'first', rules: [{ annotatedBy: 'com.example.First' }] },
          { name: 'second', rules: [{ annotatedBy: 'com.example.Second' }] },
          { name: 'third', rules: [{ interfaces: 'Runnable' }] },
        ],
      }],
    };
    const result = resolveProfiles(['multi'], config);
    expect(result.entrypoints.length).toBe(3);
  });

  test('compound entrypoint: all conditions are AND-resolved', () => {
    const config: LangToolsConfig = {
      profiles: [{
        name: 'compound',
        entrypoints: [{
          name: 'compound rule',
          rules: [
            { annotatedBy: 'com.example.MyAnnotation' },
            { implementsInterfaceFromPackage: 'com.example.*' },
          ],
        }],
      }],
    };
    const result = resolveProfiles(['compound'], config);
    expect(result.entrypoints[0].conditions.length).toBe(2);
    expect(result.entrypoints[0].conditions[0].type).toBe('annotatedBy');
    expect(result.entrypoints[0].conditions[1].type).toBe('implementsInterfaceFromPackage');
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

  test('package glob: org.springframework.* matches org.springframework.X and subpackages', () => {
    const regex = globToRegex('org.springframework.*');
    expect(regex.test('org.springframework.Boot')).toBe(true);
    expect(regex.test('org.springframework.data.Repository')).toBe(true);
    expect(regex.test('com.example.Foo')).toBe(false);
  });
});
