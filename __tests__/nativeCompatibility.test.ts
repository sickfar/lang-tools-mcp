import { describe, it, expect } from '@jest/globals';
import Parser from 'tree-sitter';
import Java from 'tree-sitter-java';
import Kotlin from '@tree-sitter-grammars/tree-sitter-kotlin';

// Grammar packages declare `language: unknown` in their type definitions;
// the cast is safe because runtime compatibility is verified by setLanguage() itself.
const JavaLang = Java as unknown as Parser.Language;
const KotlinLang = Kotlin as unknown as Parser.Language;

describe('Native module compatibility (Node.js ABI compatibility)', () => {
  it('should load tree-sitter native module', () => {
    expect(typeof Parser).toBe('function');
  });

  it('should load tree-sitter-java grammar', () => {
    expect(Java).toBeDefined();
  });

  it('should load tree-sitter-kotlin grammar', () => {
    expect(Kotlin).toBeDefined();
  });

  it('should create a Java parser and parse trivial code', () => {
    const p = new Parser();
    p.setLanguage(JavaLang);
    const tree = p.parse('class Foo {}');
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.type).toBe('program');
  });

  it('should create a Kotlin parser and parse trivial code', () => {
    const p = new Parser();
    p.setLanguage(KotlinLang);
    const tree = p.parse('class Foo');
    expect(tree.rootNode.hasError).toBe(false);
  });

  it('reports Node.js ABI version (diagnostic)', () => {
    console.log(`Node.js ${process.versions.node} (ABI ${process.versions.modules})`);
    expect(process.versions.modules).toBeDefined();
  });
});
