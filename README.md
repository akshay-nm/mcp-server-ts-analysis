# mcp-server-ts-analysis

MCP server for TypeScript type resolution and dependency graph analysis. Uses [ts-morph](https://github.com/dsherret/ts-morph) for type intelligence and [madge](https://github.com/pahen/madge) for dependency graphs. Stdio transport.

## Setup

### 1. Clone and build

```bash
git clone https://github.com/akshay-nm/mcp-server-ts-analysis.git
cd mcp-server-ts-analysis
npm install
npm run build
```

### 2. Add to Claude Code

**Global (all projects)** — add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "ts-analysis": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/mcp-server-ts-analysis/dist/bin/cli.js"]
    }
  }
}
```

**Per project** — add to `.mcp.json` in the project root:

```json
{
  "mcpServers": {
    "ts-analysis": {
      "type": "stdio",
      "command": "node",
      "args": ["./path/to/mcp-server-ts-analysis/dist/bin/cli.js"]
    }
  }
}
```

### 3. Restart Claude Code

The server will appear in your MCP server list. No startup config needed — all paths (`tsconfig`, `source_root`, etc.) are passed per tool call, so one server instance works across all your projects.

### Other MCP clients

Any MCP client that supports stdio transport can use this server. Point it at `dist/bin/cli.js` with Node.js as the command.

## Tools

### Type analysis

| Tool | Description |
|------|-------------|
| `resolve_type` | Fully computed type at a source position |
| `hover_info` | Quick info similar to VS Code hover (type, docs, JSDoc tags) |
| `type_diagnostics` | TypeScript errors and warnings, optionally scoped to a file |

**Common parameters:**

- `file` — absolute path to the TypeScript file
- `line` — line number (1-based)
- `col` — column number (1-based)
- `tsconfig` — path to tsconfig.json (optional, uses default compiler options if omitted)

### Dependency analysis

| Tool | Description |
|------|-------------|
| `dep_graph` | Full dependency tree as JSON |
| `reverse_deps` | All files that import a given file |
| `forward_deps` | All files that a given file imports |
| `circular_deps` | All circular dependency chains |
| `import_path` | Shortest import chain between two files |

**Common parameters:**

- `source_root` — source root directory to analyze (required)
- `tsconfig` — path to tsconfig.json (optional)
- `exclude` — directories to exclude (defaults to `node_modules`, `dist`, `.git`)
- `exclude_patterns` — regex patterns to exclude files (e.g. `["\\.d\\.ts$"]` to skip declaration files)

**`dep_graph` extras:**

- `entry` — entry file to start traversal from (defaults to auto-detected root nodes)
- `max_depth` — max traversal depth from entry/root nodes (omit for full graph)

## Examples

Resolve the type of a variable at line 10, column 7:

```json
{
  "tool": "resolve_type",
  "args": {
    "file": "/home/user/project/src/server.ts",
    "line": 10,
    "col": 7,
    "tsconfig": "/home/user/project/tsconfig.json"
  }
}
```

Get the top-level module boundaries (depth 1) without `.d.ts` files:

```json
{
  "tool": "dep_graph",
  "args": {
    "source_root": "/home/user/project/src",
    "tsconfig": "/home/user/project/tsconfig.json",
    "exclude_patterns": ["\\.d\\.ts$"],
    "max_depth": 1
  }
}
```

Find how `auth.ts` reaches `database.ts` through imports:

```json
{
  "tool": "import_path",
  "args": {
    "fileA": "auth.ts",
    "fileB": "database.ts",
    "source_root": "/home/user/project/src"
  }
}
```

## Architecture

```
src/
  index.ts          — MCP server, tool registration, stdio transport
  type-analysis.ts  — ts-morph type resolution (cached by tsconfig path)
  dep-analysis.ts   — madge dependency graph analysis
  types.ts          — shared interfaces
  madge.d.ts        — type declarations for madge
bin/
  cli.ts            — entry point
```

## License

MIT
