/**
 * JUnit5 profile integration tests.
 */

import { describe, it, expect } from '@jest/globals';
import * as path from 'path';
import { detectPublicDeadCodeInFiles } from '../src/publicDeadCodeDetector.js';
import { resolveProfiles } from '../src/profileConfig.js';
import { resolveFilePaths } from '../src/resolveFilePaths.js';

const JAVA_FIXTURE_ROOT = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  'fixtures/java/public_dead_code'
);

function getJavaFiles(subdir: string) {
  const dir = path.join(JAVA_FIXTURE_ROOT, subdir);
  return { dir, files: resolveFilePaths([dir], '.java').resolved };
}

const junit5Rules = resolveProfiles(['junit5'], {});

describe('JUnit5 profile integration', () => {
  const { dir, files } = getJavaFiles('annotation_rules');

  it('@Test method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', junit5Rules, [dir], ['junit5']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('testSomething');
  });

  it('@BeforeEach method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', junit5Rules, [dir], ['junit5']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('setup');
  });

  it('@AfterEach method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', junit5Rules, [dir], ['junit5']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('teardown');
  });

  it('helper method with no junit5 annotation IS reported as dead', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', junit5Rules, [dir], ['junit5']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('unusedHelper');
  });
});
