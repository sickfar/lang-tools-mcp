#!/usr/bin/env node

/**
 * MCP server for cleaning up unused imports in Java and Kotlin files.
 * Uses tree-sitter to parse and analyze code, removing only specific unused imports.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import Parser from "tree-sitter";
import Java from "tree-sitter-java";
import Kotlin from "tree-sitter-kotlin";
import * as fs from "fs";
import * as path from "path";

/**
 * Interface for import information
 */
interface ImportInfo {
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
javaParser.setLanguage(Java);

const kotlinParser = new Parser();
kotlinParser.setLanguage(Kotlin);

/**
 * Extract imports from Java source code
 */
function extractJavaImports(tree: Parser.Tree, sourceCode: string): ImportInfo[] {
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
function extractKotlinImports(tree: Parser.Tree, sourceCode: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const rootNode = tree.rootNode;

  // Find all import declarations
  const importHeaders = rootNode.descendantsOfType('import_header');

  for (const importNode of importHeaders) {
    const importText = sourceCode.substring(importNode.startIndex, importNode.endIndex);

    // Check if it's a wildcard import
    const isWildcard = importText.includes(".*");

    // Extract the imported symbols
    const symbols: string[] = [];

    if (isWildcard) {
      imports.push({
        text: importText,
        startByte: importNode.startIndex,
        endByte: importNode.endIndex,
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
        endByte: importNode.endIndex,
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
function extractUsedIdentifiers(tree: Parser.Tree, sourceCode: string, language: 'java' | 'kotlin'): Set<string> {
  const usedIdentifiers = new Set<string>();
  const rootNode = tree.rootNode;

  // Get all identifier nodes, but exclude those in import declarations and package declarations
  const identifierNodes = rootNode.descendantsOfType('identifier');

  for (const node of identifierNodes) {
    // Skip identifiers in import declarations
    let parent = node.parent;
    let inImport = false;
    let inPackage = false;

    while (parent) {
      if (language === 'java') {
        if (parent.type === 'import_declaration' || parent.type === 'package_declaration') {
          inImport = true;
          break;
        }
      } else if (language === 'kotlin') {
        if (parent.type === 'import_header' || parent.type === 'package_header') {
          inPackage = true;
          break;
        }
      }
      parent = parent.parent;
    }

    if (!inImport && !inPackage) {
      const identifier = sourceCode.substring(node.startIndex, node.endIndex);
      usedIdentifiers.add(identifier);
    }
  }

  // Also check for type references and annotations
  const typeNodes = language === 'java'
    ? rootNode.descendantsOfType('type_identifier')
    : rootNode.descendantsOfType('type_identifier');

  for (const node of typeNodes) {
    const identifier = sourceCode.substring(node.startIndex, node.endIndex);
    usedIdentifiers.add(identifier);
  }

  return usedIdentifiers;
}

/**
 * Remove unused imports from source code
 */
function removeUnusedImports(sourceCode: string, imports: ImportInfo[], usedIdentifiers: Set<string>): string {
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
function cleanupJavaFile(filePath: string): boolean {
  try {
    const sourceCode = fs.readFileSync(filePath, 'utf-8');
    const tree = javaParser.parse(sourceCode);

    if (tree.rootNode.hasError) {
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
function cleanupKotlinFile(filePath: string): boolean {
  try {
    const sourceCode = fs.readFileSync(filePath, 'utf-8');
    const tree = kotlinParser.parse(sourceCode);

    if (tree.rootNode.hasError) {
      console.error(`Syntax error in file: ${filePath}`);
      return false;
    }

    const imports = extractKotlinImports(tree, sourceCode);
    const usedIdentifiers = extractUsedIdentifiers(tree, sourceCode, 'kotlin');
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
 * Create the MCP server
 */
const server = new Server(
  {
    name: "lang-tools-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Handler that lists available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "cleanup_unused_imports_java",
        description: "Clean up unused imports in Java files. Removes specific unused imports while keeping wildcard imports.",
        inputSchema: {
          type: "object",
          properties: {
            files: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of Java file paths to clean up"
            }
          },
          required: ["files"]
        }
      },
      {
        name: "cleanup_unused_imports_kotlin",
        description: "Clean up unused imports in Kotlin files. Removes specific unused imports while keeping wildcard imports.",
        inputSchema: {
          type: "object",
          properties: {
            files: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of Kotlin file paths to clean up"
            }
          },
          required: ["files"]
        }
      }
    ]
  };
});

/**
 * Handler for tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "cleanup_unused_imports_java": {
      const files = request.params.arguments?.files as string[];

      if (!files || !Array.isArray(files)) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ status: "NOK", error: "Invalid files parameter" })
          }]
        };
      }

      let processedCount = 0;
      const errors: string[] = [];

      for (const file of files) {
        // Resolve to absolute path if needed
        const absolutePath = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);

        if (!fs.existsSync(absolutePath)) {
          errors.push(`File not found: ${file}`);
          continue;
        }

        const success = cleanupJavaFile(absolutePath);
        if (success) {
          processedCount++;
        } else {
          errors.push(`Failed to process: ${file}`);
        }
      }

      const result = {
        status: errors.length === 0 ? "OK" : "NOK",
        filesProcessed: processedCount,
        ...(errors.length > 0 && { errors })
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    }

    case "cleanup_unused_imports_kotlin": {
      const files = request.params.arguments?.files as string[];

      if (!files || !Array.isArray(files)) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ status: "NOK", error: "Invalid files parameter" })
          }]
        };
      }

      let processedCount = 0;
      const errors: string[] = [];

      for (const file of files) {
        // Resolve to absolute path if needed
        const absolutePath = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);

        if (!fs.existsSync(absolutePath)) {
          errors.push(`File not found: ${file}`);
          continue;
        }

        const success = cleanupKotlinFile(absolutePath);
        if (success) {
          processedCount++;
        } else {
          errors.push(`Failed to process: ${file}`);
        }
      }

      const result = {
        status: errors.length === 0 ? "OK" : "NOK",
        filesProcessed: processedCount,
        ...(errors.length > 0 && { errors })
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    }

    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

/**
 * Start the server using stdio transport
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Lang Tools MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
