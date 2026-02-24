/**
 * Integration tests for detect_dead_code_java and detect_dead_code_kotlin
 * MCP tool handler behaviour. Mirrors the aggregation and filtering logic in
 * src/index.ts without spinning up the full MCP server.
 */

import { describe, it, expect } from '@jest/globals';
import * as path from 'path';
import { detectDeadCodeInFile } from '../src/deadCodeDetector.js';
import { resolveFilePaths } from '../src/resolveFilePaths.js';

const JAVA_FIXTURE_ROOT = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  'fixtures/java'
);

const KOTLIN_FIXTURE_ROOT = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  'fixtures/kotlin'
);

/** Simulates what the detect_dead_code_java/kotlin handler in index.ts does. */
function runDeadCodeTool(dir: string, language: 'java' | 'kotlin') {
  const extension = language === 'java' ? '.java' : '.kt';
  const { resolved } = resolveFilePaths([dir], extension);
  const fileResults = [];
  let totalFindings = 0;
  for (const fp of resolved) {
    const result = detectDeadCodeInFile(fp, language);
    totalFindings += result.findings.length;
    fileResults.push(result);
  }
  return {
    filesProcessed: resolved.length,
    totalFindings,
    files: fileResults.filter(r => r.findings.length > 0 || r.error !== undefined),
  };
}

describe('Integration: detect_dead_code output filtering', () => {
  describe('Java', () => {
    it('files array omits files with no findings', () => {
      const result = runDeadCodeTool(path.join(JAVA_FIXTURE_ROOT, 'dead_code_filter'), 'java');
      const emptyNoError = result.files.filter(f => f.findings.length === 0 && !f.error);
      expect(emptyNoError).toHaveLength(0);
    });

    it('files array includes files that have findings', () => {
      const result = runDeadCodeTool(path.join(JAVA_FIXTURE_ROOT, 'dead_code_filter'), 'java');
      const withFindings = result.files.filter(f => f.findings.length > 0);
      expect(withFindings.length).toBeGreaterThan(0);
    });

    it('filesProcessed counts all scanned files, not just those with findings', () => {
      const result = runDeadCodeTool(path.join(JAVA_FIXTURE_ROOT, 'dead_code_filter'), 'java');
      // fixture has 2 files: HasFindings.java and NoFindings.java
      expect(result.filesProcessed).toBe(2);
      // only HasFindings.java has findings, so files array is shorter
      expect(result.files.length).toBeLessThan(result.filesProcessed);
    });

    it('totalFindings is accurate even when empty-findings files are omitted', () => {
      const result = runDeadCodeTool(path.join(JAVA_FIXTURE_ROOT, 'dead_code_filter'), 'java');
      const sum = result.files.reduce((acc, f) => acc + f.findings.length, 0);
      expect(result.totalFindings).toBe(sum);
      expect(result.totalFindings).toBeGreaterThan(0);
    });

    it('files with errors and no findings are retained in output', () => {
      const nonExistentDir = path.join(JAVA_FIXTURE_ROOT, 'dead_code_filter');
      const nonExistentPath = path.join(nonExistentDir, 'DoesNotExist.java');
      // Call detectDeadCodeInFile directly on a non-existent file — it returns an error entry
      const errorResult = detectDeadCodeInFile(nonExistentPath, 'java');
      expect(errorResult.error).toBeDefined();
      expect(errorResult.findings).toHaveLength(0);
      // Confirm the handler filter keeps it
      const kept = [errorResult].filter(r => r.findings.length > 0 || r.error !== undefined);
      expect(kept).toHaveLength(1);
    });
  });

  describe('Kotlin', () => {
    it('files array omits files with no findings', () => {
      const result = runDeadCodeTool(path.join(KOTLIN_FIXTURE_ROOT, 'dead_code_filter'), 'kotlin');
      const emptyNoError = result.files.filter(f => f.findings.length === 0 && !f.error);
      expect(emptyNoError).toHaveLength(0);
    });

    it('files array includes files that have findings', () => {
      const result = runDeadCodeTool(path.join(KOTLIN_FIXTURE_ROOT, 'dead_code_filter'), 'kotlin');
      const withFindings = result.files.filter(f => f.findings.length > 0);
      expect(withFindings.length).toBeGreaterThan(0);
    });

    it('filesProcessed counts all scanned files, not just those with findings', () => {
      const result = runDeadCodeTool(path.join(KOTLIN_FIXTURE_ROOT, 'dead_code_filter'), 'kotlin');
      // fixture has 2 files: HasFindings.kt and NoFindings.kt
      expect(result.filesProcessed).toBe(2);
      expect(result.files.length).toBeLessThan(result.filesProcessed);
    });

    it('totalFindings is accurate even when empty-findings files are omitted', () => {
      const result = runDeadCodeTool(path.join(KOTLIN_FIXTURE_ROOT, 'dead_code_filter'), 'kotlin');
      const sum = result.files.reduce((acc, f) => acc + f.findings.length, 0);
      expect(result.totalFindings).toBe(sum);
      expect(result.totalFindings).toBeGreaterThan(0);
    });

    it('files with errors and no findings are retained in output', () => {
      const nonExistentDir = path.join(KOTLIN_FIXTURE_ROOT, 'dead_code_filter');
      const nonExistentPath = path.join(nonExistentDir, 'DoesNotExist.kt');
      const errorResult = detectDeadCodeInFile(nonExistentPath, 'kotlin');
      expect(errorResult.error).toBeDefined();
      expect(errorResult.findings).toHaveLength(0);
      const kept = [errorResult].filter(r => r.findings.length > 0 || r.error !== undefined);
      expect(kept).toHaveLength(1);
    });
  });
});
