/**
 * Tests for compound rule matching (AND logic within entrypoints).
 * Validates that multiple conditions must ALL match for a declaration to be kept alive.
 */

import { describe, it, expect } from '@jest/globals';
import * as path from 'path';
import { detectPublicDeadCodeInFiles } from '../src/publicDeadCodeDetector.js';
import {
  resolveProfiles,
  annotationMatchesImport,
  interfaceIsFromPackage,
  globToRegex,
} from '../src/profileConfig.js';
import { resolveFilePaths } from '../src/resolveFilePaths.js';

const JAVA_FIXTURE_ROOT = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  'fixtures/java/public_dead_code'
);

const KOTLIN_FIXTURE_ROOT = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  'fixtures/kotlin/public_dead_code'
);

function getJavaFiles(subdir: string) {
  const dir = path.join(JAVA_FIXTURE_ROOT, subdir);
  return { dir, files: resolveFilePaths([dir], '.java').resolved };
}

function getKotlinFiles(subdir: string) {
  const dir = path.join(KOTLIN_FIXTURE_ROOT, subdir);
  return { dir, files: resolveFilePaths([dir], '.kt').resolved };
}

// ─── Unit tests for annotationMatchesImport ──────────────────────────────────

describe('annotationMatchesImport', () => {
  it('exact import matches', () => {
    expect(annotationMatchesImport(
      'org.springframework.stereotype.Component',
      'org.springframework.stereotype.Component'
    )).toBe(true);
  });

  it('wildcard import matching exact package matches', () => {
    expect(annotationMatchesImport(
      'org.springframework.stereotype.Component',
      'org.springframework.stereotype.*'
    )).toBe(true);
  });

  it('broader wildcard import matches (org.springframework.*)', () => {
    expect(annotationMatchesImport(
      'org.springframework.stereotype.Component',
      'org.springframework.*'
    )).toBe(true);
  });

  it('wildcard import from wrong package does NOT match', () => {
    expect(annotationMatchesImport(
      'org.springframework.stereotype.Component',
      'com.example.*'
    )).toBe(false);
  });

  it('different exact FQN does NOT match', () => {
    expect(annotationMatchesImport(
      'org.springframework.stereotype.Component',
      'org.springframework.stereotype.Service'
    )).toBe(false);
  });

  it('annotation FQN with no package (no dot) returns false', () => {
    expect(annotationMatchesImport('Component', 'Component')).toBe(false);
  });

  it('sibling package wildcard does NOT match (org.springframework.beans.* vs org.springframework.stereotype.X)', () => {
    expect(annotationMatchesImport(
      'org.springframework.stereotype.Component',
      'org.springframework.beans.*'
    )).toBe(false);
  });
});

// ─── Unit tests for interfaceIsFromPackage ───────────────────────────────────

describe('interfaceIsFromPackage', () => {
  it('interface resolved via exact import matches pattern', () => {
    const pattern = globToRegex('org.springframework.*');
    const fileImports = ['org.springframework.boot.ApplicationRunner'];
    expect(interfaceIsFromPackage('ApplicationRunner', pattern, fileImports)).toBe(true);
  });

  it('interface resolved via wildcard import matches pattern', () => {
    const pattern = globToRegex('org.springframework.*');
    const fileImports = ['org.springframework.boot.*'];
    expect(interfaceIsFromPackage('ApplicationRunner', pattern, fileImports)).toBe(true);
  });

  it('interface not in imports returns false', () => {
    const pattern = globToRegex('org.springframework.*');
    const fileImports = ['com.example.Foo'];
    expect(interfaceIsFromPackage('ApplicationRunner', pattern, fileImports)).toBe(false);
  });

  it('interface imported from non-matching package returns false', () => {
    const pattern = globToRegex('org.springframework.*');
    const fileImports = ['com.example.ApplicationRunner'];
    expect(interfaceIsFromPackage('ApplicationRunner', pattern, fileImports)).toBe(false);
  });

  it('empty imports returns false', () => {
    const pattern = globToRegex('org.springframework.*');
    expect(interfaceIsFromPackage('ApplicationRunner', pattern, [])).toBe(false);
  });
});

// ─── Java compound rules integration tests ───────────────────────────────────

describe('Java compound rules: spring profile', () => {
  const { dir, files } = getJavaFiles('compound_rules');
  const springRules = resolveProfiles(['spring'], {});

  it('@Component + implements Spring interface → NOT reported (alive via compound rule)', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('ComponentWithInterface');
  });

  it('Method in @Component+Spring-interface class → NOT reported (alive via class cascade)', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('unusedButClassAlive');
  });

  it('@Component alone (no Spring interface) → reported as DEAD', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('ComponentAlone');
  });

  it('Method in @Component-alone class → reported as DEAD', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('doWork');
  });

  it('@Service + implements Spring interface → NOT reported (alive via compound rule)', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('ServiceWithInterface');
  });

  it('Unannotated class implementing Spring interface → reported as DEAD', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('UnannotatedWithInterface');
  });

  it('@Configuration class → NOT reported (single-condition entrypoint)', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('MyConfig');
  });

  it('@Bean method in @Configuration class → NOT reported (single-condition entrypoint)', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('myBean');
  });

  it('Plain helper method in @Configuration class → NOT reported (cascade from class)', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('unusedHelper');
  });
});

// ─── Kotlin compound rules integration tests ──────────────────────────────────

describe('Kotlin compound rules: spring profile', () => {
  const { dir, files } = getKotlinFiles('compound_rules');
  const springRules = resolveProfiles(['spring'], {});

  it('@Component + implements Spring interface → NOT reported (alive via compound rule)', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('ComponentWithInterface');
  });

  it('Method in @Component+Spring-interface class → NOT reported (alive via class cascade)', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('unusedButClassAlive');
  });

  it('@Component alone (no Spring interface) → reported as DEAD', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('ComponentAlone');
  });

  it('Method in @Component-alone class → reported as DEAD', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('doWork');
  });

  it('@Service + implements Spring interface → NOT reported (alive via compound rule)', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('ServiceWithInterface');
  });

  it('Unannotated class implementing Spring interface → reported as DEAD', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('UnannotatedWithInterface');
  });

  it('@Configuration class → NOT reported (single-condition entrypoint)', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('MyConfig');
  });

  it('@Bean method in @Configuration class → NOT reported (single-condition entrypoint)', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('myBean');
  });

  it('Plain helper method in @Configuration class → NOT reported (cascade from class)', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('unusedHelper');
  });
});

// ─── Backward-compat: existing annotation/interface/serviceDiscovery tests still pass ─

describe('backward-compat: annotation-only entrypoints still work', () => {
  it('java: spring @Bean - single-condition entrypoint unaffected', () => {
    const { dir, files } = getJavaFiles('annotation_rules');
    const rules = resolveProfiles(['spring'], {});
    const result = detectPublicDeadCodeInFiles(files, 'java', rules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('configuredBean');
    expect(allNames).toContain('unusedMethod');
  });

  it('java: junit5 @Test - single-condition entrypoint unaffected', () => {
    const { dir, files } = getJavaFiles('annotation_rules');
    const rules = resolveProfiles(['junit5'], {});
    const result = detectPublicDeadCodeInFiles(files, 'java', rules, [dir], ['junit5']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('testSomething');
    expect(allNames).not.toContain('setup');
    expect(allNames).not.toContain('teardown');
  });

  it('java: interface rule (single-condition) still protects whole class', () => {
    const { dir, files } = getJavaFiles('interface_rule');
    const rules = resolveProfiles(['myProfile'], {
      profiles: [{ name: 'myProfile', entrypoints: [{ name: 'interface Serializable', rules: [{ interfaces: 'Serializable' }] }] }]
    });
    const result = detectPublicDeadCodeInFiles(files, 'java', rules, [dir], ['myProfile']);
    const serializableFindings = result.files
      .filter(f => f.file.includes('SerializableImpl'))
      .flatMap(f => f.findings.map(x => x.name));
    expect(serializableFindings).not.toContain('readObject');
    expect(serializableFindings).not.toContain('unusedPublic');
  });

  it('java: service discovery rule (single-condition) still protects registered class', () => {
    const { dir, files } = getJavaFiles('service_discovery');
    const rules = resolveProfiles(['myProfile'], {
      profiles: [{ name: 'myProfile', entrypoints: [{ name: 'service discovery', rules: [{ serviceDiscovery: true }] }] }]
    });
    const result = detectPublicDeadCodeInFiles(files, 'java', rules, [dir], ['myProfile']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('ServiceImpl');
    expect(allNames).toContain('UnlistedImpl');
  });
});
