import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { resolveFilePaths } from '../src/resolveFilePaths.js';

const tmpBase = path.join(process.cwd(), '__tests__', 'temp', 'resolve-test');

function createFile(relPath: string, content = '') {
  const full = path.join(tmpBase, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
  return full;
}

describe('resolveFilePaths', () => {
  beforeEach(() => {
    fs.mkdirSync(tmpBase, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  });

  it('should return a single file path as-is', () => {
    const file = createFile('Test.java');
    const result = resolveFilePaths([file], '.java');
    expect(result.resolved).toEqual([file]);
    expect(result.errors).toEqual([]);
  });

  it('should recursively find matching files in a directory', () => {
    const f1 = createFile('src/A.java');
    const f2 = createFile('src/sub/B.java');
    createFile('src/C.kt');
    createFile('src/readme.txt');

    const result = resolveFilePaths([path.join(tmpBase, 'src')], '.java');
    expect(result.resolved.sort()).toEqual([f1, f2].sort());
    expect(result.errors).toEqual([]);
  });

  it('should combine files and directories', () => {
    const f1 = createFile('single/One.kt');
    const f2 = createFile('dir/Two.kt');
    const f3 = createFile('dir/sub/Three.kt');

    const result = resolveFilePaths(
      [f1, path.join(tmpBase, 'dir')],
      '.kt'
    );
    expect(result.resolved.sort()).toEqual([f1, f2, f3].sort());
    expect(result.errors).toEqual([]);
  });

  it('should report non-existent paths as errors', () => {
    const f1 = createFile('Exists.java');
    const missing = path.join(tmpBase, 'nope.java');

    const result = resolveFilePaths([f1, missing], '.java');
    expect(result.resolved).toEqual([f1]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].path).toBe(missing);
    expect(result.errors[0].message).toContain('nope.java');
  });

  it('should return empty resolved for directory with no matching files', () => {
    createFile('dir/readme.txt');
    const result = resolveFilePaths([path.join(tmpBase, 'dir')], '.java');
    expect(result.resolved).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('should find files in nested subdirectories', () => {
    const f1 = createFile('a/b/c/Deep.java');
    const result = resolveFilePaths([path.join(tmpBase, 'a')], '.java');
    expect(result.resolved).toEqual([f1]);
  });

  it('should only pick files with the correct extension', () => {
    createFile('mixed/A.java');
    const kt = createFile('mixed/B.kt');
    createFile('mixed/C.txt');

    const result = resolveFilePaths([path.join(tmpBase, 'mixed')], '.kt');
    expect(result.resolved).toEqual([kt]);
  });
});
