import { describe, it, expect } from '@jest/globals';
import * as path from 'path';
import { detectPublicDeadCodeInFiles } from '../src/publicDeadCodeDetector.js';
import { resolveProfiles } from '../src/profileConfig.js';
import { resolveFilePaths } from '../src/resolveFilePaths.js';

const KOTLIN_FIXTURE_ROOT = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  'fixtures/kotlin/public_dead_code'
);

function fixtureDir(name: string) {
  return path.join(KOTLIN_FIXTURE_ROOT, name);
}

function getFiles(dir: string): string[] {
  return resolveFilePaths([dir], '.kt').resolved;
}

describe('kotlin basic cross-file analysis', () => {
  const dir = fixtureDir('basic');
  const files = getFiles(dir);
  const noRules = resolveProfiles([], {});

  it('usedFun is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('usedFun');
  });

  it('unusedFun is reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('unusedFun');
  });

  it('usedProp is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('usedProp');
  });

  it('unusedProp is reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('unusedProp');
  });
});

describe('kotlin internal visibility', () => {
  const dir = fixtureDir('internal_visibility');
  const files = getFiles(dir);
  const noRules = resolveProfiles([], {});

  it('unusedInternal is reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('unusedInternal');
  });

  it('usedInternal is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('usedInternal');
  });

  it('privateMethod is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('privateMethod');
  });

  it('unusedProp (internal) is reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('unusedProp');
  });
});

describe('kotlin top-level functions and properties', () => {
  const dir = fixtureDir('top_level');
  const files = getFiles(dir);
  const noRules = resolveProfiles([], {});

  it('unusedTopLevel is reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('unusedTopLevel');
  });

  it('unusedTopLevel has enclosingScope <top-level>', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const finding = result.files
      .flatMap(f => f.findings)
      .find(x => x.name === 'unusedTopLevel');
    expect(finding?.enclosingScope).toBe('<top-level>');
  });

  it('unusedTopProp is reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('unusedTopProp');
  });

  it('usedTopLevel is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('usedTopLevel');
  });

  it('usedTopProp is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('usedTopProp');
  });
});

describe('kotlin data class', () => {
  const dir = fixtureDir('data_class');
  const files = getFiles(dir);
  const noRules = resolveProfiles([], {});

  it('generated component1 is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('component1');
    expect(allNames).not.toContain('component2');
  });

  it('copy/equals/hashCode/toString are NOT reported for data class', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('copy');
    expect(allNames).not.toContain('equals');
    expect(allNames).not.toContain('hashCode');
    expect(allNames).not.toContain('toString');
  });

  it('unusedMethod in data class IS reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('unusedMethod');
  });
});

describe('kotlin companion object', () => {
  const dir = fixtureDir('companion');
  const files = getFiles(dir);
  const noRules = resolveProfiles([], {});

  it('unusedCompanionFun is reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('unusedCompanionFun');
  });

  it('usedCompanionFun is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('usedCompanionFun');
  });
});

describe('kotlin abstract method tracking', () => {
  const dir = fixtureDir('abstract');
  const files = getFiles(dir);
  const noRules = resolveProfiles([], {});

  it('orphan abstract method (no concrete impl) IS reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('orphan');
  });

  it('withImpl is NOT reported (has concrete override in ConcreteImpl)', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('withImpl');
  });
});

describe('kotlin external override handling', () => {
  const dir = fixtureDir('external_override');
  const files = getFiles(dir);

  it('default - toString, equals, hashCode NOT reported (keepExternalOverrides=true)', () => {
    const rules = resolveProfiles([], {});
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', rules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('toString');
    expect(allNames).not.toContain('equals');
    expect(allNames).not.toContain('hashCode');
  });

  it('keepExternalOverrides: false - override methods ARE reported', () => {
    const rules = resolveProfiles(['strict'], {
      profiles: [{ name: 'strict', keepExternalOverrides: false, entrypoints: [] }]
    });
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', rules, [dir], ['strict']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('toString');
    expect(allNames).toContain('equals');
    expect(allNames).toContain('hashCode');
  });
});

describe('kotlin string template $name form', () => {
  const dir = fixtureDir('string_template');
  const files = getFiles(dir);
  const noRules = resolveProfiles([], {});

  it('usedInTemplate is NOT reported (referenced via $name in string)', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('usedInTemplate');
  });

  it('unusedProp is reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('unusedProp');
  });
});

describe('kotlin android profile', () => {
  const dir = fixtureDir('android_profile');
  const files = getFiles(dir);

  it('without android profile - lifecycle methods are reported', () => {
    const noRules = resolveProfiles([], {});
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('onCreate');
    expect(allNames).toContain('onDestroy');
    expect(allNames).toContain('onResume');
  });

  it('with android profile - onCreate, onDestroy, onResume NOT reported', () => {
    const rules = resolveProfiles(['android'], {});
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', rules, [dir], ['android']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('onCreate');
    expect(allNames).not.toContain('onDestroy');
    expect(allNames).not.toContain('onResume');
  });

  it('with android profile - customHelper is still reported', () => {
    const rules = resolveProfiles(['android'], {});
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', rules, [dir], ['android']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('customHelper');
  });
});

describe('kotlin enum', () => {
  const dir = fixtureDir('enum');
  const files = getFiles(dir);
  const noRules = resolveProfiles([], {});

  it('enum constants are NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('NORTH');
    expect(allNames).not.toContain('SOUTH');
    expect(allNames).not.toContain('EAST');
    expect(allNames).not.toContain('WEST');
  });

  it('unusedMethod in enum IS reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('unusedMethod');
  });
});

describe('kotlin extension functions cross-file analysis', () => {
  const dir = fixtureDir('extension_functions');
  const files = getFiles(dir);
  const noRules = resolveProfiles([], {});

  it('used extension function toTitleCase is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('toTitleCase');
  });

  it('unused extension function toSnakeCase IS reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('toSnakeCase');
  });

  it('used extension property wordCount is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('wordCount');
  });

  it('unused extension property isBlankOrEmpty IS reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', noRules, [dir], []);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('isBlankOrEmpty');
  });
});
