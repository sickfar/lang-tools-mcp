/**
 * Tests for file package and import extraction helpers.
 * These helpers are used to add filePackage and fileImports to Declaration objects,
 * enabling import-resolution-based condition matching in Stage 3.
 */

import { describe, it, expect } from '@jest/globals';
import { parseJava, parseKotlin } from '../src/importCleaner.js';
import {
  extractFilePackageJava,
  extractFilePackageKotlin,
  extractFileImportsJava,
  extractFileImportsKotlin,
} from '../src/publicDeadCodeDetector.js';

describe('extractFilePackageJava', () => {
  it('returns empty string for file with no package declaration', () => {
    const src = `public class Foo {}`;
    const tree = parseJava(src);
    expect(extractFilePackageJava(tree.rootNode, src)).toBe('');
  });

  it('returns the package name for a simple package declaration', () => {
    const src = `package com.example.app;\npublic class Foo {}`;
    const tree = parseJava(src);
    expect(extractFilePackageJava(tree.rootNode, src)).toBe('com.example.app');
  });

  it('handles deeply nested package name', () => {
    const src = `package org.springframework.boot.autoconfigure;\npublic class Foo {}`;
    const tree = parseJava(src);
    expect(extractFilePackageJava(tree.rootNode, src)).toBe('org.springframework.boot.autoconfigure');
  });
});

describe('extractFileImportsJava', () => {
  it('returns empty array for file with no imports', () => {
    const src = `public class Foo {}`;
    const tree = parseJava(src);
    expect(extractFileImportsJava(tree.rootNode, src)).toEqual([]);
  });

  it('returns exact import FQNs for specific imports', () => {
    const src = `
import org.springframework.stereotype.Component;
import org.springframework.context.annotation.Bean;
public class Foo {}
    `.trim();
    const tree = parseJava(src);
    const imports = extractFileImportsJava(tree.rootNode, src);
    expect(imports).toContain('org.springframework.stereotype.Component');
    expect(imports).toContain('org.springframework.context.annotation.Bean');
  });

  it('preserves wildcard imports as-is (e.g. org.springframework.*)', () => {
    const src = `
import org.springframework.*;
import java.util.List;
public class Foo {}
    `.trim();
    const tree = parseJava(src);
    const imports = extractFileImportsJava(tree.rootNode, src);
    expect(imports).toContain('org.springframework.*');
    expect(imports).toContain('java.util.List');
  });

  it('handles static imports', () => {
    const src = `
import static org.junit.jupiter.api.Assertions.assertEquals;
public class Foo {}
    `.trim();
    const tree = parseJava(src);
    const imports = extractFileImportsJava(tree.rootNode, src);
    // Static imports may or may not be included — just verify no crash
    expect(Array.isArray(imports)).toBe(true);
  });
});

describe('extractFilePackageKotlin', () => {
  it('returns empty string for file with no package header', () => {
    const src = `class Foo`;
    const tree = parseKotlin(src);
    expect(extractFilePackageKotlin(tree.rootNode, src)).toBe('');
  });

  it('returns the package name for a simple package header', () => {
    const src = `package com.example.app\nclass Foo`;
    const tree = parseKotlin(src);
    expect(extractFilePackageKotlin(tree.rootNode, src)).toBe('com.example.app');
  });

  it('handles deeply nested package name', () => {
    const src = `package org.springframework.boot.autoconfigure\nclass Foo`;
    const tree = parseKotlin(src);
    expect(extractFilePackageKotlin(tree.rootNode, src)).toBe('org.springframework.boot.autoconfigure');
  });
});

describe('extractFileImportsKotlin', () => {
  it('returns empty array for file with no imports', () => {
    const src = `class Foo`;
    const tree = parseKotlin(src);
    expect(extractFileImportsKotlin(tree.rootNode, src)).toEqual([]);
  });

  it('returns exact import FQNs for specific imports', () => {
    const src = `
import org.springframework.stereotype.Component
import org.springframework.context.annotation.Bean
class Foo
    `.trim();
    const tree = parseKotlin(src);
    const imports = extractFileImportsKotlin(tree.rootNode, src);
    expect(imports).toContain('org.springframework.stereotype.Component');
    expect(imports).toContain('org.springframework.context.annotation.Bean');
  });

  it('preserves wildcard imports as-is', () => {
    const src = `
import org.springframework.*
import java.util.List
class Foo
    `.trim();
    const tree = parseKotlin(src);
    const imports = extractFileImportsKotlin(tree.rootNode, src);
    expect(imports).toContain('org.springframework.*');
    expect(imports).toContain('java.util.List');
  });

  it('strips alias from aliased imports (import Foo as Bar -> stored as FQN without alias)', () => {
    const src = `
import org.example.Foo as Bar
class MyClass
    `.trim();
    const tree = parseKotlin(src);
    const imports = extractFileImportsKotlin(tree.rootNode, src);
    // Should store the original FQN without the alias
    expect(imports).toContain('org.example.Foo');
    expect(imports).not.toContain('org.example.Foo as Bar');
    expect(imports).not.toContain('Bar');
  });
});
