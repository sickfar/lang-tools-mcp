/**
 * Integration tests for detect_public_dead_code_java and detect_public_dead_code_kotlin
 * MCP tool handlers. Exercises the full stack: config loading → profile resolution →
 * file scanning → detection → formatted response.
 */

import { describe, it, expect } from '@jest/globals';
import * as path from 'path';
import { loadConfig, mergeActiveProfiles, resolveProfiles } from '../src/profileConfig.js';
import { detectPublicDeadCodeInFiles } from '../src/publicDeadCodeDetector.js';
import { resolveFilePaths } from '../src/resolveFilePaths.js';

const JAVA_FIXTURE_ROOT = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  'fixtures/java/public_dead_code'
);

const KOTLIN_FIXTURE_ROOT = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  'fixtures/kotlin/public_dead_code'
);

function runJavaTool(fixtureSubdir: string, toolActiveProfiles?: string[]) {
  const dir = path.join(JAVA_FIXTURE_ROOT, fixtureSubdir);
  const config = loadConfig();
  const activeProfiles = mergeActiveProfiles(config, toolActiveProfiles);
  const resolvedRules = resolveProfiles(activeProfiles, config);
  const { resolved } = resolveFilePaths([dir], '.java');
  return detectPublicDeadCodeInFiles(resolved, 'java', resolvedRules, [dir], activeProfiles);
}

function runKotlinTool(fixtureSubdir: string, toolActiveProfiles?: string[]) {
  const dir = path.join(KOTLIN_FIXTURE_ROOT, fixtureSubdir);
  const config = loadConfig();
  const activeProfiles = mergeActiveProfiles(config, toolActiveProfiles);
  const resolvedRules = resolveProfiles(activeProfiles, config);
  const { resolved } = resolveFilePaths([dir], '.kt');
  return detectPublicDeadCodeInFiles(resolved, 'kotlin', resolvedRules, [dir], activeProfiles);
}

describe('Integration: detect_public_dead_code_java', () => {
  it('response includes sourceRoots, filesAnalyzed, activeProfiles, totalFindings, files', () => {
    const result = runJavaTool('basic');
    expect(result.status).toBe('OK');
    expect(Array.isArray(result.sourceRoots)).toBe(true);
    expect(result.sourceRoots.length).toBeGreaterThan(0);
    expect(typeof result.filesAnalyzed).toBe('number');
    expect(result.filesAnalyzed).toBeGreaterThan(0);
    expect(Array.isArray(result.activeProfiles)).toBe(true);
    expect(typeof result.totalFindings).toBe('number');
    expect(Array.isArray(result.files)).toBe(true);
  });

  it('totalFindings matches sum of findings in files array', () => {
    const result = runJavaTool('basic');
    const sumFindings = result.files.reduce((acc, f) => acc + f.findings.length, 0);
    expect(result.totalFindings).toBe(sumFindings);
  });

  it('activeProfiles in tool call overrides config file value', () => {
    // Tool passes ['spring'] — should show up in result even if config has nothing
    const result = runJavaTool('annotation_rules', ['spring']);
    expect(result.activeProfiles).toEqual(['spring']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    // @Bean method should be kept by spring profile
    expect(allNames).not.toContain('configuredBean');
    // Plain unused method should still be reported
    expect(allNames).toContain('unusedMethod');
  });

  it('no activeProfiles → no profiles in result', () => {
    const result = runJavaTool('basic', []);
    expect(result.activeProfiles).toEqual([]);
  });

  it('keepExternalOverrides: false via custom profile causes toString override to be reported', () => {
    // Can't easily pass custom profiles via the tool handler since it loads from config.
    // Test via direct API call with resolved rules.
    const dir = path.join(JAVA_FIXTURE_ROOT, 'external_override');
    const { resolved } = resolveFilePaths([dir], '.java');
    const strictRules = resolveProfiles(['strict'], {
      profiles: [{ name: 'strict', keepExternalOverrides: false, entrypoints: [] }]
    });
    const result = detectPublicDeadCodeInFiles(resolved, 'java', strictRules, [dir], ['strict']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).toContain('toString');
    expect(allNames).toContain('equals');
  });

  it('unused public method finding has correct category', () => {
    const result = runJavaTool('basic');
    const unusedMethodFinding = result.files
      .flatMap(f => f.findings)
      .find(x => x.name === 'unusedMethod');
    expect(unusedMethodFinding).toBeDefined();
    expect(unusedMethodFinding!.category).toBe('unused_public_method');
  });

  it('unused public field finding has correct category', () => {
    const result = runJavaTool('basic');
    const unusedFieldFinding = result.files
      .flatMap(f => f.findings)
      .find(x => x.name === 'unusedField');
    expect(unusedFieldFinding).toBeDefined();
    expect(unusedFieldFinding!.category).toBe('unused_public_field');
  });
});

describe('Integration: detect_public_dead_code_kotlin', () => {
  it('response has correct structure', () => {
    const result = runKotlinTool('basic');
    expect(result.status).toBe('OK');
    expect(Array.isArray(result.sourceRoots)).toBe(true);
    expect(typeof result.filesAnalyzed).toBe('number');
    expect(result.filesAnalyzed).toBeGreaterThan(0);
    expect(Array.isArray(result.activeProfiles)).toBe(true);
    expect(typeof result.totalFindings).toBe('number');
  });

  it('android profile activeProfiles overrides empty config', () => {
    const result = runKotlinTool('android_profile', ['android']);
    expect(result.activeProfiles).toEqual(['android']);
    const allNames = result.files.flatMap(f => f.findings.map(x => x.name));
    expect(allNames).not.toContain('onCreate');
    expect(allNames).not.toContain('onDestroy');
    expect(allNames).toContain('customHelper');
  });

  it('totalFindings matches sum of findings in files', () => {
    const result = runKotlinTool('basic');
    const sum = result.files.reduce((acc, f) => acc + f.findings.length, 0);
    expect(result.totalFindings).toBe(sum);
  });
});

describe('Integration: output filtering — files with no findings are omitted', () => {
  // filter_output fixture: HasFindings has unused members, NoFindings has all members used
  it('java: files array omits files with no findings', () => {
    const result = runJavaTool('filter_output');
    const emptyNoError = result.files.filter(f => f.findings.length === 0 && !f.error);
    expect(emptyNoError).toHaveLength(0);
  });

  it('java: files array includes files that have findings', () => {
    const result = runJavaTool('filter_output');
    const withFindings = result.files.filter(f => f.findings.length > 0);
    expect(withFindings.length).toBeGreaterThan(0);
  });

  it('java: filesAnalyzed counts all scanned files, not just those with findings', () => {
    const result = runJavaTool('filter_output');
    // fixture has 2 files: HasFindings.java and NoFindings.java
    expect(result.filesAnalyzed).toBe(2);
    // but only HasFindings.java has findings, so files array is shorter
    expect(result.files.length).toBeLessThan(result.filesAnalyzed);
  });

  it('java: totalFindings is accurate even when empty-findings files are omitted', () => {
    const result = runJavaTool('filter_output');
    const sum = result.files.reduce((acc, f) => acc + f.findings.length, 0);
    expect(result.totalFindings).toBe(sum);
    expect(result.totalFindings).toBeGreaterThan(0);
  });

  it('kotlin: files array omits files with no findings', () => {
    const result = runKotlinTool('filter_output');
    const emptyNoError = result.files.filter(f => f.findings.length === 0 && !f.error);
    expect(emptyNoError).toHaveLength(0);
  });

  it('kotlin: filesAnalyzed counts all scanned files, not just those with findings', () => {
    const result = runKotlinTool('filter_output');
    // fixture has 2 files: HasFindings.kt and NoFindings.kt
    expect(result.filesAnalyzed).toBe(2);
    expect(result.files.length).toBeLessThan(result.filesAnalyzed);
  });

  it('kotlin: totalFindings is accurate even when empty-findings files are omitted', () => {
    const result = runKotlinTool('filter_output');
    const sum = result.files.reduce((acc, f) => acc + f.findings.length, 0);
    expect(result.totalFindings).toBe(sum);
    expect(result.totalFindings).toBeGreaterThan(0);
  });

  it('java: files with errors and no findings are retained in output', () => {
    const dir = path.join(JAVA_FIXTURE_ROOT, 'filter_output');
    const config = loadConfig();
    const activeProfiles = mergeActiveProfiles(config, undefined);
    const resolvedRules = resolveProfiles(activeProfiles, config);
    const nonExistentPath = path.join(dir, 'DoesNotExist.java');
    const result = detectPublicDeadCodeInFiles(
      [nonExistentPath],
      'java',
      resolvedRules,
      [dir],
      activeProfiles,
    );
    expect(result.files).toHaveLength(1);
    expect(result.files[0].error).toBeDefined();
    expect(result.files[0].findings).toHaveLength(0);
  });

  it('kotlin: files with errors and no findings are retained in output', () => {
    const dir = path.join(KOTLIN_FIXTURE_ROOT, 'filter_output');
    const config = loadConfig();
    const activeProfiles = mergeActiveProfiles(config, undefined);
    const resolvedRules = resolveProfiles(activeProfiles, config);
    const nonExistentPath = path.join(dir, 'DoesNotExist.kt');
    const result = detectPublicDeadCodeInFiles(
      [nonExistentPath],
      'kotlin',
      resolvedRules,
      [dir],
      activeProfiles,
    );
    expect(result.files).toHaveLength(1);
    expect(result.files[0].error).toBeDefined();
    expect(result.files[0].findings).toHaveLength(0);
  });
});
