/**
 * Micronaut profile integration tests.
 * Validates that the micronaut built-in profile correctly identifies live vs dead code.
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

const micronautRules = resolveProfiles(['micronaut'], {});

describe('Micronaut profile integration — Java', () => {
  const { dir, files } = getJavaFiles('micronaut');

  it('@Controller class is NOT reported as dead', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('UserController');
  });

  it('@Get method inside @Controller is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('getUsers');
    expect(allNames).not.toContain('createUser');
  });

  it('helper method inside @Controller is NOT reported (class cascade)', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('helperMethod');
  });

  it('@Factory class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('ServiceFactory');
  });

  it('@Bean method inside @Factory is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('createService');
  });

  it('@Scheduled method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('doWork');
  });

  it('@EventListener method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('onEvent');
  });

  it('@Filter class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('LogFilter');
  });

  it('@Client interface is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('ApiClient');
  });

  it('@ConfigurationProperties class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('AppConfig');
  });

  it('@ServerWebSocket class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('WsServer');
  });

  it('@Put endpoint method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('updateUser');
  });

  it('@Delete endpoint method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('deleteUser');
  });

  it('@Patch endpoint method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('patchUser');
  });

  it('@Options endpoint method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('optionsUsers');
  });

  it('@Head endpoint method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('headUsers');
  });

  it('@Singleton class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('AppSingleton');
  });

  it('@Inject field is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('userService');
  });

  it('@ClientWebSocket interface is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('WsClient');
  });

  it('class with no micronaut annotations IS reported as dead', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('UnusedClass');
  });

  it('method with no micronaut annotations IS reported as dead', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('deadMethod');
  });
});

describe('Micronaut profile integration — Kotlin', () => {
  const { dir, files } = getKotlinFiles('micronaut');

  it('@Controller class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('UserController');
  });

  it('@Get methods inside @Controller are NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('getUsers');
    expect(allNames).not.toContain('getItems');
  });

  it('helper method inside @Controller is NOT reported (class cascade)', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('helperMethod');
  });

  it('@Factory class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('ServiceFactory');
  });

  it('@Bean method inside @Factory is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('createService');
  });

  it('@Scheduled method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('doWork');
  });

  it('@EventListener method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('onEvent');
  });

  it('@ConfigurationProperties class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('AppConfig');
  });

  it('class with no micronaut annotations IS reported as dead', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('UnusedClass');
  });

  it('method with no micronaut annotations IS reported as dead', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', micronautRules, [dir], ['micronaut']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('deadMethod');
  });
});
