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
      customProfiles: { strict: { keepExternalOverrides: false, rules: [] } }
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
