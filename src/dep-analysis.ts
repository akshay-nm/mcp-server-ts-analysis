import path from "node:path";
import madge, { type MadgeInstance } from "madge";
import type { DepGraph, ImportChain } from "./types.js";

/** Normalize a file path to match madge's key format (relative to source root, no leading ./) */
function toMadgeKey(file: string, sourceRoot: string): string {
  const abs = path.resolve(file);
  const root = path.resolve(sourceRoot);
  if (abs.startsWith(root + path.sep)) {
    return abs.slice(root.length + 1);
  }
  // Already a relative key — strip leading ./
  return file.replace(/^\.\//, "");
}

async function getMadge(sourceRoot: string, tsconfig?: string, exclude?: string[], excludePatterns?: string[]): Promise<MadgeInstance> {
  const excludeDirs = exclude ?? ["node_modules", "dist", ".git"];
  const regexps: RegExp[] = excludeDirs.map(
    (dir) => new RegExp(`(^|/)${dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(/|$)`)
  );
  if (excludePatterns) {
    for (const pat of excludePatterns) regexps.push(new RegExp(pat));
  }
  return madge(sourceRoot, {
    tsConfig: tsconfig,
    fileExtensions: ["ts", "tsx", "js", "jsx"],
    excludeRegExp: regexps,
  });
}

export async function depGraph(sourceRoot: string, tsconfig?: string, exclude?: string[], excludePatterns?: string[], entry?: string, maxDepth?: number): Promise<DepGraph> {
  const m = await getMadge(sourceRoot, tsconfig, exclude, excludePatterns);
  const full = m.obj();
  if (maxDepth == null) return full;

  // BFS from entry points, only keeping nodes within maxDepth
  const roots = entry ? [toMadgeKey(entry, sourceRoot)] : Object.keys(full).filter((f) => !Object.values(full).some((deps) => deps.includes(f)));
  if (roots.length === 0) return full;

  const result: DepGraph = {};
  const visited = new Set<string>();
  const queue: [string, number][] = roots.map((r) => [r, 0]);
  for (const r of roots) visited.add(r);

  while (queue.length > 0) {
    const [file, depth] = queue.shift()!;
    const deps = full[file] ?? [];
    result[file] = depth < maxDepth ? deps : [];
    if (depth < maxDepth) {
      for (const dep of deps) {
        if (!visited.has(dep)) {
          visited.add(dep);
          queue.push([dep, depth + 1]);
        }
      }
    }
  }
  return result;
}

export async function reverseDeps(file: string, sourceRoot: string, tsconfig?: string, exclude?: string[], excludePatterns?: string[]): Promise<string[]> {
  const m = await getMadge(sourceRoot, tsconfig, exclude, excludePatterns);
  return m.depends(toMadgeKey(file, sourceRoot));
}

export async function forwardDeps(file: string, sourceRoot: string, tsconfig?: string, exclude?: string[], excludePatterns?: string[]): Promise<string[]> {
  const m = await getMadge(sourceRoot, tsconfig, exclude, excludePatterns);
  const graph = m.obj();
  return graph[toMadgeKey(file, sourceRoot)] ?? [];
}

export async function circularDeps(sourceRoot: string, tsconfig?: string, exclude?: string[], excludePatterns?: string[]): Promise<string[][]> {
  const m = await getMadge(sourceRoot, tsconfig, exclude, excludePatterns);
  return m.circular();
}

export async function importPath(fileA: string, fileB: string, sourceRoot: string, tsconfig?: string, exclude?: string[], excludePatterns?: string[]): Promise<ImportChain> {
  const m = await getMadge(sourceRoot, tsconfig, exclude, excludePatterns);
  const graph = m.obj();
  const chain = bfs(graph, toMadgeKey(fileA, sourceRoot), toMadgeKey(fileB, sourceRoot));
  return { found: chain !== null, path: chain ?? [] };
}

function bfs(graph: DepGraph, start: string, end: string): string[] | null {
  if (start === end) return [start];
  const queue: string[][] = [[start]];
  const visited = new Set<string>([start]);
  while (queue.length > 0) {
    const p = queue.shift()!;
    const current = p[p.length - 1];
    for (const neighbor of graph[current] ?? []) {
      if (neighbor === end) return [...p, neighbor];
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...p, neighbor]);
      }
    }
  }
  return null;
}
