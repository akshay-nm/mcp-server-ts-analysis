import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as typeAnalysis from "./type-analysis.js";
import * as depAnalysis from "./dep-analysis.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "mcp-server-ts-analysis",
    version: "1.0.0",
  });

  // ── Type analysis tools ───────────────────────────────────────────

  server.tool(
    "resolve_type",
    "Fully computed type at a source position",
    {
      file: z.string().describe("Absolute path to the TypeScript file"),
      line: z.number().int().min(1).describe("Line number (1-based)"),
      col: z.number().int().min(1).describe("Column number (1-based)"),
      tsconfig: z.string().optional().describe("Path to tsconfig.json (auto-detected if omitted)"),
    },
    async ({ file, line, col, tsconfig }) => {
      try {
        const result = typeAnalysis.resolveType(file, line, col, tsconfig);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: errMsg(e) }], isError: true };
      }
    }
  );

  server.tool(
    "hover_info",
    "Quick info at a source position, similar to VS Code hover",
    {
      file: z.string().describe("Absolute path to the TypeScript file"),
      line: z.number().int().min(1).describe("Line number (1-based)"),
      col: z.number().int().min(1).describe("Column number (1-based)"),
      tsconfig: z.string().optional().describe("Path to tsconfig.json (auto-detected if omitted)"),
    },
    async ({ file, line, col, tsconfig }) => {
      try {
        const result = typeAnalysis.hoverInfo(file, line, col, tsconfig);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: errMsg(e) }], isError: true };
      }
    }
  );

  server.tool(
    "type_diagnostics",
    "TypeScript errors and warnings, optionally scoped to a single file",
    {
      file: z.string().optional().describe("Absolute path to scope diagnostics to a single file"),
      tsconfig: z.string().optional().describe("Path to tsconfig.json (auto-detected if omitted)"),
    },
    async ({ file, tsconfig }) => {
      try {
        const result = typeAnalysis.typeDiagnostics(file, tsconfig);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: errMsg(e) }], isError: true };
      }
    }
  );

  // ── Dependency analysis tools ─────────────────────────────────────

  server.tool(
    "dep_graph",
    "Full dependency tree as JSON",
    {
      entry: z.string().optional().describe("Entry file or directory (defaults to source_root)"),
      source_root: z.string().describe("Source root directory to analyze"),
      tsconfig: z.string().optional().describe("Path to tsconfig.json"),
      exclude: z.array(z.string()).optional().describe("Directories to exclude"),
      exclude_patterns: z.array(z.string()).optional().describe("Regex patterns to exclude files (e.g. \"\\.d\\.ts$\" to skip declaration files)"),
      max_depth: z.number().int().min(1).optional().describe("Max traversal depth from entry/root nodes. Omit for full graph."),
    },
    async ({ entry, source_root, tsconfig, exclude, exclude_patterns, max_depth }) => {
      try {
        const result = await depAnalysis.depGraph(source_root, tsconfig, exclude, exclude_patterns, entry, max_depth);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: errMsg(e) }], isError: true };
      }
    }
  );

  server.tool(
    "reverse_deps",
    "Find all files that import a given file",
    {
      file: z.string().describe("Module path to find reverse dependencies for"),
      source_root: z.string().describe("Source root directory to analyze"),
      tsconfig: z.string().optional().describe("Path to tsconfig.json"),
      exclude: z.array(z.string()).optional().describe("Directories to exclude"),
      exclude_patterns: z.array(z.string()).optional().describe("Regex patterns to exclude files (e.g. \"\\.d\\.ts$\" to skip declaration files)"),
    },
    async ({ file, source_root, tsconfig, exclude, exclude_patterns }) => {
      try {
        const result = await depAnalysis.reverseDeps(file, source_root, tsconfig, exclude, exclude_patterns);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: errMsg(e) }], isError: true };
      }
    }
  );

  server.tool(
    "forward_deps",
    "Find all files that a given file imports",
    {
      file: z.string().describe("Module path to find forward dependencies for"),
      source_root: z.string().describe("Source root directory to analyze"),
      tsconfig: z.string().optional().describe("Path to tsconfig.json"),
      exclude: z.array(z.string()).optional().describe("Directories to exclude"),
      exclude_patterns: z.array(z.string()).optional().describe("Regex patterns to exclude files (e.g. \"\\.d\\.ts$\" to skip declaration files)"),
    },
    async ({ file, source_root, tsconfig, exclude, exclude_patterns }) => {
      try {
        const result = await depAnalysis.forwardDeps(file, source_root, tsconfig, exclude, exclude_patterns);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: errMsg(e) }], isError: true };
      }
    }
  );

  server.tool(
    "circular_deps",
    "Find all circular dependency chains",
    {
      source_root: z.string().describe("Source root directory to analyze"),
      tsconfig: z.string().optional().describe("Path to tsconfig.json"),
      exclude: z.array(z.string()).optional().describe("Directories to exclude"),
      exclude_patterns: z.array(z.string()).optional().describe("Regex patterns to exclude files (e.g. \"\\.d\\.ts$\" to skip declaration files)"),
    },
    async ({ source_root, tsconfig, exclude, exclude_patterns }) => {
      try {
        const result = await depAnalysis.circularDeps(source_root, tsconfig, exclude, exclude_patterns);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: errMsg(e) }], isError: true };
      }
    }
  );

  server.tool(
    "import_path",
    "Find the shortest import chain between two files",
    {
      fileA: z.string().describe("Starting module path"),
      fileB: z.string().describe("Target module path"),
      source_root: z.string().describe("Source root directory to analyze"),
      tsconfig: z.string().optional().describe("Path to tsconfig.json"),
      exclude: z.array(z.string()).optional().describe("Directories to exclude"),
      exclude_patterns: z.array(z.string()).optional().describe("Regex patterns to exclude files (e.g. \"\\.d\\.ts$\" to skip declaration files)"),
    },
    async ({ fileA, fileB, source_root, tsconfig, exclude, exclude_patterns }) => {
      try {
        const result = await depAnalysis.importPath(fileA, fileB, source_root, tsconfig, exclude, exclude_patterns);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: errMsg(e) }], isError: true };
      }
    }
  );

  return server;
}

export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("code-intelligence-mcp server running on stdio");
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
