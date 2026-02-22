/**
 * Jakarta profile integration tests.
 * Validates that the jakarta built-in profile correctly identifies live vs dead code.
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

const jakartaRules = resolveProfiles(['jakarta'], {});

describe('Jakarta profile integration — Java', () => {
  const { dir, files } = getJavaFiles('jakarta');

  it('@Singleton class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', jakartaRules, [dir], ['jakarta']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('UserService');
  });

  it('@Inject field is NOT reported (class cascade from @Singleton)', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', jakartaRules, [dir], ['jakarta']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('repo');
  });

  it('@ApplicationScoped class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', jakartaRules, [dir], ['jakarta']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('OrderService');
  });

  it('@RequestScoped class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', jakartaRules, [dir], ['jakarta']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('RequestHandler');
  });

  it('@SessionScoped class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', jakartaRules, [dir], ['jakarta']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('SessionData');
  });

  it('@Path class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', jakartaRules, [dir], ['jakarta']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('UserResource');
  });

  it('@GET method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', jakartaRules, [dir], ['jakarta']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('getAll');
  });

  it('@POST method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', jakartaRules, [dir], ['jakarta']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('create');
  });

  it('@Stateless class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', jakartaRules, [dir], ['jakarta']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('StatelessBean');
  });

  it('@Stateful class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', jakartaRules, [dir], ['jakarta']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('StatefulBean');
  });

  it('@Produces method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', jakartaRules, [dir], ['jakarta']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('produce');
  });

  it('@Entity class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', jakartaRules, [dir], ['jakarta']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('User');
  });

  it('class with no jakarta annotations IS reported as dead', () => {
    const result = detectPublicDeadCodeInFiles(files, 'java', jakartaRules, [dir], ['jakarta']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('UnusedClass');
  });
});

describe('Jakarta profile integration — Kotlin', () => {
  const { dir, files } = getKotlinFiles('jakarta');

  it('@Singleton class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', jakartaRules, [dir], ['jakarta']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('UserService');
  });

  it('@ApplicationScoped class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', jakartaRules, [dir], ['jakarta']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('OrderService');
  });

  it('@Path class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', jakartaRules, [dir], ['jakarta']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('UserResource');
  });

  it('@GET method is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', jakartaRules, [dir], ['jakarta']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('getAll');
  });

  it('@Stateless class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', jakartaRules, [dir], ['jakarta']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('StatelessBean');
  });

  it('@Entity class is NOT reported', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', jakartaRules, [dir], ['jakarta']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('User');
  });

  it('class with no jakarta annotations IS reported as dead', () => {
    const result = detectPublicDeadCodeInFiles(files, 'kotlin', jakartaRules, [dir], ['jakarta']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('UnusedClass');
  });
});
