/**
 * Core logic for cleaning up unused imports in Java and Kotlin files.
 */

import Parser from "tree-sitter";
import Java from "tree-sitter-java";
import Kotlin from "@tree-sitter-grammars/tree-sitter-kotlin";
import * as fs from "fs";

/**
 * Interface for import information
 */
export interface ImportInfo {
  text: string;
  startByte: number;
  endByte: number;
  symbols: string[];
  isWildcard: boolean;
  isStatic: boolean;
}

/**
 * Create parsers for Java and Kotlin
 */
const javaParser = new Parser();
javaParser.setLanguage(Java as unknown as Parser.Language);

const kotlinParser = new Parser();
kotlinParser.setLanguage(Kotlin as unknown as Parser.Language);

/**
 * Extract imports from Java source code
 */
export function extractJavaImports(tree: Parser.Tree, sourceCode: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const rootNode = tree.rootNode;

  // Find all import declarations
  const importNodes = rootNode.descendantsOfType('import_declaration');

  for (const importNode of importNodes) {
    const importText = sourceCode.substring(importNode.startIndex, importNode.endIndex);

    // Check if it's a wildcard import
    const isWildcard = importText.includes(".*");
    const isStatic = importText.includes("static");

    // Extract the imported symbols
    const symbols: string[] = [];

    if (isWildcard) {
      // For wildcard imports, we don't track specific symbols
      imports.push({
        text: importText,
        startByte: importNode.startIndex,
        endByte: importNode.endIndex,
        symbols: [],
        isWildcard: true,
        isStatic,
      });
    } else {
      // Extract the class/member name from the import
      // e.g., "import java.util.List;" -> "List"
      // e.g., "import static java.lang.Math.PI;" -> "PI"
      const parts = importText.replace(/^import\s+(static\s+)?/, '').replace(/;$/, '').trim().split('.');
      const symbol = parts[parts.length - 1];

      symbols.push(symbol);

      imports.push({
        text: importText,
        startByte: importNode.startIndex,
        endByte: importNode.endIndex,
        symbols,
        isWildcard: false,
        isStatic,
      });
    }
  }

  return imports;
}

/**
 * Extract imports from Kotlin source code
 */
export function extractKotlinImports(tree: Parser.Tree, sourceCode: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const rootNode = tree.rootNode;

  // Find all import declarations (node type changed from 'import_header' to 'import' in
  // @tree-sitter-grammars/tree-sitter-kotlin; filter childCount > 0 to skip the keyword leaf)
  const importHeaders = rootNode.descendantsOfType('import').filter(n => n.childCount > 0);

  for (const importNode of importHeaders) {
    // Tree-sitter's Kotlin parser sometimes includes trailing content (comments, whitespace)
    // in the import_header node. We need to extract only the actual import statement.
    // Find the first newline after the import starts to get the actual import text.
    let fullText = sourceCode.substring(importNode.startIndex, importNode.endIndex);
    let importText = fullText;
    let actualEndByte = importNode.endIndex;

    const firstNewline = fullText.indexOf('\n');
    if (firstNewline !== -1) {
      importText = fullText.substring(0, firstNewline);
      actualEndByte = importNode.startIndex + firstNewline;
    }

    // Check if it's a wildcard import
    const isWildcard = importText.includes(".*");

    // Extract the imported symbols
    const symbols: string[] = [];

    if (isWildcard) {
      imports.push({
        text: importText,
        startByte: importNode.startIndex,
        endByte: actualEndByte,
        symbols: [],
        isWildcard: true,
        isStatic: false,
      });
    } else {
      // Extract the class/member name from the import
      // e.g., "import java.util.List" -> "List"
      // Handle aliased imports: "import java.util.List as MyList" -> "MyList"
      let symbol: string;

      if (importText.includes(" as ")) {
        const parts = importText.split(" as ");
        symbol = parts[1].trim();
      } else {
        const parts = importText.replace(/^import\s+/, '').trim().split('.');
        symbol = parts[parts.length - 1];
      }

      symbols.push(symbol);

      imports.push({
        text: importText,
        startByte: importNode.startIndex,
        endByte: actualEndByte,
        symbols,
        isWildcard: false,
        isStatic: false,
      });
    }
  }

  return imports;
}

/**
 * Extract all identifiers used in the source code (excluding imports and package declarations)
 */
export function extractUsedIdentifiers(tree: Parser.Tree, sourceCode: string, language: 'java' | 'kotlin'): Set<string> {
  const usedIdentifiers = new Set<string>();
  const rootNode = tree.rootNode;

  // Get all identifier nodes, but exclude those in import declarations and package declarations
  const identifierTypes = language === 'java'
    ? ['identifier', 'type_identifier']
    : ['identifier'];

  for (const identifierType of identifierTypes) {
    const identifierNodes = rootNode.descendantsOfType(identifierType);

    for (const node of identifierNodes) {
      // Skip identifiers in import declarations and package declarations
      let parent = node.parent;
      let inImportOrPackage = false;

      while (parent) {
        if (language === 'java') {
          if (parent.type === 'import_declaration' || parent.type === 'package_declaration') {
            inImportOrPackage = true;
            break;
          }
        } else if (language === 'kotlin') {
          if (parent.type === 'import' || parent.type === 'package_header') {
            inImportOrPackage = true;
            break;
          }
        }
        parent = parent.parent;
      }

      if (!inImportOrPackage) {
        const identifier = sourceCode.substring(node.startIndex, node.endIndex);
        usedIdentifiers.add(identifier);
      }
    }
  }

  return usedIdentifiers;
}

/**
 * Detect Kotlin operator function names that are used implicitly through language syntax
 * rather than explicit identifier calls (e.g. `by` delegation, `for` loops, destructuring,
 * indexed access, arithmetic operators).
 */
export function extractImplicitlyUsedOperators(tree: Parser.Tree, _language: 'kotlin'): Set<string> {
  const implicit = new Set<string>();
  const root = tree.rootNode;

  // by delegation → getValue, setValue, provideDelegate
  if (root.descendantsOfType('property_delegate').length > 0) {
    implicit.add('getValue');
    implicit.add('setValue');
    implicit.add('provideDelegate');
  }

  // for loop → iterator, hasNext, next
  if (root.descendantsOfType('for_statement').length > 0) {
    implicit.add('iterator');
    implicit.add('hasNext');
    implicit.add('next');
  }

  // destructuring → component1, component2, …
  const destructuring = root.descendantsOfType('multi_variable_declaration');
  for (const node of destructuring) {
    const count = node.namedChildren.filter((c: Parser.SyntaxNode) => c.type === 'variable_declaration').length;
    for (let i = 1; i <= count; i++) {
      implicit.add(`component${i}`);
    }
  }

  // indexed access → get, set
  if (root.descendantsOfType('index_expression').length > 0) {
    implicit.add('get');
    implicit.add('set');
  }

  // arithmetic / comparison operators → operator function names
  // Note: @tree-sitter-grammars/tree-sitter-kotlin renamed several expression node types:
  //   additive/multiplicative/comparison_expression → binary_expression
  //   prefix/postfix_expression → unary_expression
  //   check_expression → in_expression (handled below) / is_expression (no operator function, omitted)
  const operatorNodeMap: Record<string, string[]> = {
    // binary_expression covers: +, -, *, /, %, <, >, <=, >=, ==, etc.
    binary_expression: ['plus', 'minus', 'times', 'div', 'rem', 'compareTo'],
    range_expression: ['rangeTo'],
    // in_expression covers: x in y (contains) and x !in y (not contains)
    in_expression: ['contains'],
    // unary_expression covers both prefix (-a, !a, ++a, --a) and postfix (a++, a--)
    unary_expression: ['unaryPlus', 'unaryMinus', 'not', 'inc', 'dec'],
  };
  for (const [nodeType, operators] of Object.entries(operatorNodeMap)) {
    if (root.descendantsOfType(nodeType).length > 0) {
      for (const op of operators) implicit.add(op);
    }
  }

  return implicit;
}

/**
 * Remove unused imports from source code
 */
export function removeUnusedImports(sourceCode: string, imports: ImportInfo[], usedIdentifiers: Set<string>): string {
  const unusedImports: ImportInfo[] = [];

  for (const imp of imports) {
    // Keep wildcard imports (safer approach)
    if (imp.isWildcard) {
      continue;
    }

    // Check if any of the import's symbols are used
    const isUsed = imp.symbols.some(symbol => usedIdentifiers.has(symbol));

    if (!isUsed) {
      unusedImports.push(imp);
    }
  }

  // Sort by position in reverse order to avoid index shifting
  unusedImports.sort((a, b) => b.startByte - a.startByte);

  // Remove unused imports
  let modifiedCode = sourceCode;
  for (const imp of unusedImports) {
    // Remove the import line including the newline
    let endIndex = imp.endByte;

    // Include the newline character after the import if present
    if (modifiedCode[endIndex] === '\n') {
      endIndex++;
    } else if (modifiedCode[endIndex] === '\r' && modifiedCode[endIndex + 1] === '\n') {
      endIndex += 2;
    }

    modifiedCode = modifiedCode.substring(0, imp.startByte) + modifiedCode.substring(endIndex);
  }

  return modifiedCode;
}

/**
 * Clean up unused imports in a Java file
 */
export function cleanupJavaFile(filePath: string): boolean {
  try {
    const sourceCode = fs.readFileSync(filePath, 'utf-8');
    const tree = javaParser.parse(sourceCode);

    if (!tree.rootNode || tree.rootNode.hasError) {
      console.error(`Syntax error in file: ${filePath}`);
      return false;
    }

    const imports = extractJavaImports(tree, sourceCode);
    const usedIdentifiers = extractUsedIdentifiers(tree, sourceCode, 'java');
    const modifiedCode = removeUnusedImports(sourceCode, imports, usedIdentifiers);

    if (modifiedCode !== sourceCode) {
      fs.writeFileSync(filePath, modifiedCode, 'utf-8');
      return true;
    }

    return true;
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return false;
  }
}

/**
 * Clean up unused imports in a Kotlin file
 */
export function cleanupKotlinFile(filePath: string): boolean {
  try {
    const sourceCode = fs.readFileSync(filePath, 'utf-8');
    const tree = kotlinParser.parse(sourceCode);

    if (!tree.rootNode || tree.rootNode.hasError) {
      console.error(`Syntax error in file: ${filePath}`);
      return false;
    }

    const imports = extractKotlinImports(tree, sourceCode);
    const usedIdentifiers = extractUsedIdentifiers(tree, sourceCode, 'kotlin');
    const implicitOperators = extractImplicitlyUsedOperators(tree, 'kotlin');
    for (const op of implicitOperators) usedIdentifiers.add(op);
    const modifiedCode = removeUnusedImports(sourceCode, imports, usedIdentifiers);

    if (modifiedCode !== sourceCode) {
      fs.writeFileSync(filePath, modifiedCode, 'utf-8');
      return true;
    }

    return true;
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return false;
  }
}

/**
 * Parse Java source code
 */
export function parseJava(sourceCode: string): Parser.Tree {
  return javaParser.parse(sourceCode);
}

/**
 * Parse Kotlin source code
 */
export function parseKotlin(sourceCode: string): Parser.Tree {
  return kotlinParser.parse(sourceCode);
}
