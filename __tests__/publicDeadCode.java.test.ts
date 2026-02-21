import { describe, it, expect } from '@jest/globals';
import * as path from 'path';
import { detectPublicDeadCodeInFiles } from '../src/publicDeadCodeDetector.js';
import { resolveProfiles } from '../src/profileConfig.js';
import { resolveFilePaths } from '../src/resolveFilePaths.js';

const JAVA_FIXTURE_ROOT = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  'fixtures/java/public_dead_code'
);

function fixtureDir(name: string) {
  return path.join(JAVA_FIXTURE_ROOT, name);
}

function getFiles(dir: string): string[] {
  return resolveFilePaths([dir], '.java').resolved;
}

describe('basic cross-file analysis', () => {
  const dir = fixtureDir('basic');
  const files = getFiles(dir);
  const noRules = resolveProfiles([], {});

  it('filesAnalyzed matches actual file count', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', noRules, [dir], []);
    expect(result.filesAnalyzed).toBe(files.length);
  });

  it('used method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('usedMethod');
  });

  it('unused method is reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('unusedMethod');
  });

  it('used field is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('usedField');
  });

  it('unused field is reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('unusedField');
  });

  it('response has correct output structure', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', noRules, [dir], []);
    expect(result.status).toBe('OK');
    expect(result.sourceRoots).toEqual([dir]);
    expect(result.activeProfiles).toEqual([]);
    expect(typeof result.totalFindings).toBe('number');
    expect(Array.isArray(result.files)).toBe(true);
  });

  it('each finding has required fields', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', noRules, [dir], []);
    for (const fileResult of result.files) {
      for (const finding of fileResult.findings) {
        expect(finding.category).toBeTruthy();
        expect(finding.name).toBeTruthy();
        expect(typeof finding.line).toBe('number');
        expect(typeof finding.column).toBe('number');
        expect(finding.enclosingScope).toBeTruthy();
        expect(finding.message).toBeTruthy();
      }
    }
  });
});

describe('visibility filtering', () => {
  const dir = fixtureDir('visibility');
  const files = getFiles(dir);
  const noRules = resolveProfiles([], {});

  it('private members are never reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('privateField');
    expect(allNames).not.toContain('privateMethod');
  });

  it('package-private members are never reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('packagePrivateField');
    expect(allNames).not.toContain('packagePrivateMethod');
  });

  it('public members are reported if unused', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('publicField');
    expect(allNames).toContain('publicMethod');
  });

  it('protected members are reported if unused', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('protectedField');
    expect(allNames).toContain('protectedMethod');
  });
});

describe('annotation rules', () => {
  const dir = fixtureDir('annotation_rules');
  const files = getFiles(dir);

  it('no profiles - all unreferenced members reported', () => {
    const noRules = resolveProfiles([], {});
    const result = detectPublicDeadCodeInFiles(files, 'java', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('unusedMethod');
  });

  it('spring profile - @Bean method NOT reported', () => {
    const rules = resolveProfiles(['spring'], {});
    const result = detectPublicDeadCodeInFiles(files, 'java', rules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('configuredBean');
  });

  it('spring profile - plain unused method still reported', () => {
    const rules = resolveProfiles(['spring'], {});
    const result = detectPublicDeadCodeInFiles(files, 'java', rules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('unusedMethod');
  });

  it('junit5 profile - @Test method NOT reported', () => {
    const rules = resolveProfiles(['junit5'], {});
    const result = detectPublicDeadCodeInFiles(files, 'java', rules, [dir], ['junit5']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('testSomething');
    expect(allNames).not.toContain('setup');
    expect(allNames).not.toContain('teardown');
  });

  it('junit5 profile - unused helper still reported', () => {
    const rules = resolveProfiles(['junit5'], {});
    const result = detectPublicDeadCodeInFiles(files, 'java', rules, [dir], ['junit5']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('unusedHelper');
  });
});

describe('name pattern rules', () => {
  const dir = fixtureDir('name_pattern');
  const files = getFiles(dir);

  it('get* pattern keeps getName and getId', () => {
    const activeRules = resolveProfiles(['myProfile'], {
      customProfiles: { myProfile: { rules: [{ type: 'namePattern', patterns: ['get*'] }] } }
    });
    const result = detectPublicDeadCodeInFiles(files, 'java', activeRules, [dir], ['myProfile']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('getName');
    expect(allNames).not.toContain('getId');
    expect(allNames).toContain('fetchData');
    expect(allNames).toContain('computeResult');
  });

  it('* pattern keeps everything', () => {
    const rules = resolveProfiles(['myProfile'], {
      customProfiles: { myProfile: { rules: [{ type: 'namePattern', patterns: ['*'] }] } }
    });
    const result = detectPublicDeadCodeInFiles(files, 'java', rules, [dir], ['myProfile']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('fetchData');
    expect(allNames).not.toContain('computeResult');
  });
});

describe('interface rules', () => {
  const dir = fixtureDir('interface_rule');
  const files = getFiles(dir);

  it('interface rule protects ALL members of matching class', () => {
    const rules = resolveProfiles(['myProfile'], {
      customProfiles: { myProfile: { rules: [{ type: 'interface', interfaces: ['Serializable'] }] } }
    });
    const result = detectPublicDeadCodeInFiles(files, 'java', rules, [dir], ['myProfile']);
    // Check per-file: SerializableImpl's members should not be reported (whole class protected)
    const serializableFindings = result.files
      .filter(f => f.file.includes('SerializableImpl'))
      .flatMap(f => f.findings.map(x => x.name));
    // ALL members of SerializableImpl are protected (whole class matches interface rule)
    expect(serializableFindings).not.toContain('readObject');
    expect(serializableFindings).not.toContain('writeObject');
    expect(serializableFindings).not.toContain('unusedPublic');
  });

  it('PlainClass methods are reported (no interface match)', () => {
    const rules = resolveProfiles(['myProfile'], {
      customProfiles: { myProfile: { rules: [{ type: 'interface', interfaces: ['Serializable'] }] } }
    });
    const result = detectPublicDeadCodeInFiles(files, 'java', rules, [dir], ['myProfile']);
    const plainClassFindings = result.files
      .filter(f => f.file.includes('PlainClass'))
      .flatMap(f => f.findings.map(x => x.name));
    expect(plainClassFindings.length).toBeGreaterThan(0);
  });
});

describe('service discovery rule', () => {
  const dir = fixtureDir('service_discovery');
  const files = getFiles(dir);

  it('class in META-INF/services is kept', () => {
    const rules = resolveProfiles(['myProfile'], {
      customProfiles: { myProfile: { rules: [{ type: 'serviceDiscovery' }] } }
    });
    const result = detectPublicDeadCodeInFiles(files, 'java', rules, [dir], ['myProfile']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('ServiceImpl');
  });

  it('unlisted class is reported', () => {
    const rules = resolveProfiles(['myProfile'], {
      customProfiles: { myProfile: { rules: [{ type: 'serviceDiscovery' }] } }
    });
    const result = detectPublicDeadCodeInFiles(files, 'java', rules, [dir], ['myProfile']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('UnlistedImpl');
  });
});

describe('external override handling', () => {
  const dir = fixtureDir('external_override');
  const files = getFiles(dir);

  it('keepExternalOverrides: true (default) - @Override methods NOT reported', () => {
    const rules = resolveProfiles([], {});
    const result = detectPublicDeadCodeInFiles(files, 'java', rules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('toString');
    expect(allNames).not.toContain('equals');
  });

  it('keepExternalOverrides: false - @Override methods ARE reported', () => {
    const rules = resolveProfiles(['strict'], {
      customProfiles: { strict: { keepExternalOverrides: false, rules: [] } }
    });
    const result = detectPublicDeadCodeInFiles(files, 'java', rules, [dir], ['strict']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('toString');
    expect(allNames).toContain('equals');
  });
});

describe('abstract method tracking', () => {
  const dir = fixtureDir('abstract');
  const files = getFiles(dir);
  const noRules = resolveProfiles([], {});

  it('abstract method with concrete impl elsewhere is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('abstractWithImpl');
  });

  it('abstract method with no impl anywhere IS reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('abstractOrphan');
  });

  it('abstract method in lone class with no impl IS reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('loneMethod');
  });
});

describe('hardcoded rules', () => {
  const dir = fixtureDir('hardcoded');
  const files = getFiles(dir);
  const noRules = resolveProfiles([], {});

  it('main(String[]) is never reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('main');
  });

  it('enum constants are never reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('FOO');
    expect(allNames).not.toContain('BAR');
  });

  it('non-main non-constant public members are reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('helper');
    expect(allNames).toContain('enumMethod');
  });
});

describe('protected visibility', () => {
  const dir = fixtureDir('protected');
  const files = getFiles(dir);
  const noRules = resolveProfiles([], {});

  it('protected method called in subclass is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('protectedUsed');
  });

  it('protected method never called is reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('protectedUnused');
  });
});
