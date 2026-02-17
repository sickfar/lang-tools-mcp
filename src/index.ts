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
import { cleanupJavaFile, cleanupKotlinFile } from "./importCleaner.js";
import { detectDeadCodeInFile } from "./deadCodeDetector.js";
import { resolveFilePaths } from "./resolveFilePaths.js";

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
            paths: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of Java file paths or directories to clean up. Directories are scanned recursively for .java files."
            }
          },
          required: ["paths"]
        }
      },
      {
        name: "cleanup_unused_imports_kotlin",
        description: "Clean up unused imports in Kotlin files. Removes specific unused imports while keeping wildcard imports.",
        inputSchema: {
          type: "object",
          properties: {
            paths: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of Kotlin file paths or directories to clean up. Directories are scanned recursively for .kt files."
            }
          },
          required: ["paths"]
        }
      },
      {
        name: "detect_dead_code_java",
        description: "Detect dead code in Java files. Finds unused parameters, local variables, private fields, and private methods. Detection only — does not modify files.",
        inputSchema: {
          type: "object",
          properties: {
            paths: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of Java file paths or directories to analyze. Directories are scanned recursively for .java files."
            }
          },
          required: ["paths"]
        }
      },
      {
        name: "detect_dead_code_kotlin",
        description: "Detect dead code in Kotlin files. Finds unused parameters, local variables, private fields, and private methods. Detection only — does not modify files.",
        inputSchema: {
          type: "object",
          properties: {
            paths: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of Kotlin file paths or directories to analyze. Directories are scanned recursively for .kt files."
            }
          },
          required: ["paths"]
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
      const paths = request.params.arguments?.paths as string[];

      if (!paths || !Array.isArray(paths)) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ status: "NOK", error: "Invalid paths parameter" })
          }]
        };
      }

      const { resolved, errors: resolveErrors } = resolveFilePaths(paths, ".java");
      let processedCount = 0;
      const errors: string[] = resolveErrors.map(e => e.message);

      for (const absolutePath of resolved) {
        const success = cleanupJavaFile(absolutePath);
        if (success) {
          processedCount++;
        } else {
          errors.push(`Failed to process: ${absolutePath}`);
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
      const paths = request.params.arguments?.paths as string[];

      if (!paths || !Array.isArray(paths)) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ status: "NOK", error: "Invalid paths parameter" })
          }]
        };
      }

      const { resolved, errors: resolveErrors } = resolveFilePaths(paths, ".kt");
      let processedCount = 0;
      const errors: string[] = resolveErrors.map(e => e.message);

      for (const absolutePath of resolved) {
        const success = cleanupKotlinFile(absolutePath);
        if (success) {
          processedCount++;
        } else {
          errors.push(`Failed to process: ${absolutePath}`);
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

    case "detect_dead_code_java":
    case "detect_dead_code_kotlin": {
      const language = request.params.name === "detect_dead_code_java" ? "java" : "kotlin";
      const extension = language === "java" ? ".java" : ".kt";
      const paths = request.params.arguments?.paths as string[];

      if (!paths || !Array.isArray(paths)) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ status: "NOK", error: "Invalid paths parameter" })
          }]
        };
      }

      const { resolved, errors: resolveErrors } = resolveFilePaths(paths, extension);
      const fileResults = [];
      let totalFindings = 0;

      for (const resolveError of resolveErrors) {
        fileResults.push({ file: resolveError.path, findings: [], error: resolveError.message });
      }

      for (const absolutePath of resolved) {
        const result = detectDeadCodeInFile(absolutePath, language);
        totalFindings += result.findings.length;
        fileResults.push(result);
      }

      const response = {
        status: "OK",
        filesProcessed: resolved.length,
        totalFindings,
        files: fileResults,
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(response, null, 2)
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
