/**
 * Spring profile integration tests covering extended spring annotations
 * (RestController, request mappings, Scheduled, EventListener, Autowired, Value, ConfigurationProperties).
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

const springRules = resolveProfiles(['spring'], {});

describe('Spring profile — extended annotation coverage', () => {
  const { dir, files } = getJavaFiles('spring_extended');

  it('@RestController class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('UserRestController');
  });

  it('@RequestMapping on class is NOT reported (entrypoint match)', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    // UserRestController has @RequestMapping — class is alive, so all members are cascade-protected
    expect(allNames).not.toContain('UserRestController');
  });

  it('@GetMapping method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('listUsers');
  });

  it('@PostMapping method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('createUser');
  });

  it('@PutMapping method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('updateUser');
  });

  it('@DeleteMapping method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('deleteUser');
  });

  it('@PatchMapping method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('patchUser');
  });

  it('@Autowired constructor is NOT reported (class cascade from @RestController)', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    // Constructor is not collected as a named member (no separate finding for constructor)
    // But the Autowired annotation matches the entrypoint directly
    expect(allNames).not.toContain('UserRestController'); // class is alive
  });

  it('@Value field is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('appName');
  });

  it('@Scheduled method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('doScheduledWork');
  });

  it('@EventListener method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('handleEvent');
  });

  it('@ConfigurationProperties class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('AppProperties');
  });

  it('class with no spring annotations IS reported as dead', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('UnusedService');
  });

  it('method with no spring annotations IS reported as dead', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', springRules, [dir], ['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('unusedServiceMethod');
  });
});
