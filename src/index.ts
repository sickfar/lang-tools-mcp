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
import * as path from "path";
import * as fs from "fs";
import { cleanupJavaFile, cleanupKotlinFile } from "./importCleaner.js";

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
