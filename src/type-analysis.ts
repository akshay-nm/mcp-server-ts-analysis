import fs from "node:fs";
import path from "node:path";
import {
  Project,
  SourceFile,
  Node,
  DiagnosticMessageChain,
  ts,
} from "ts-morph";
import type { TypeInfo, HoverInfo, Diagnostic } from "./types.js";

const projectCache = new Map<string, Project>();

function getProject(tsconfigPath?: string): Project {
  const resolved = tsconfigPath ? path.resolve(tsconfigPath) : "__default__";

  let project = projectCache.get(resolved);
  if (project) return project;

  if (tsconfigPath && fs.existsSync(path.resolve(tsconfigPath))) {
    project = new Project({
      tsConfigFilePath: path.resolve(tsconfigPath),
      skipAddingFilesFromTsConfig: false,
    });
  } else {
    project = new Project({
      compilerOptions: { strict: true, target: 99, module: 99 },
    });
  }

  projectCache.set(resolved, project);
  return project;
}

function getSourceFile(project: Project, filePath: string): SourceFile {
  const abs = path.resolve(filePath);
  return project.getSourceFile(abs) ?? project.addSourceFileAtPath(abs);
}

function positionFromLineCol(sf: SourceFile, line: number, col: number): number {
  return sf.compilerNode.getPositionOfLineAndCharacter(line - 1, col - 1);
}

export function resolveType(file: string, line: number, col: number, tsconfig?: string): TypeInfo {
  const project = getProject(tsconfig);
  const sf = getSourceFile(project, file);
  const pos = positionFromLineCol(sf, line, col);
  const node = sf.getDescendantAtPos(pos);

  if (!node) throw new Error(`No node found at ${file}:${line}:${col}`);

  const type = node.getType();
  const checker = project.getTypeChecker().compilerObject;
  const symbol = checker.getSymbolAtLocation(node.compilerNode);

  return {
    type: type.getText(node, ts.TypeFormatFlags.NoTruncation),
    symbol: symbol?.getName() ?? null,
    documentation: docText(checker, node) ,
    file,
    line,
    column: col,
  };
}

export function hoverInfo(file: string, line: number, col: number, tsconfig?: string): HoverInfo {
  const project = getProject(tsconfig);
  const sf = getSourceFile(project, file);
  const pos = positionFromLineCol(sf, line, col);
  const node = sf.getDescendantAtPos(pos);

  if (!node) throw new Error(`No node found at ${file}:${line}:${col}`);

  const type = node.getType();
  const checker = project.getTypeChecker().compilerObject;
  const symbol = checker.getSymbolAtLocation(node.compilerNode);

  const symbolName = symbol?.getName() ?? node.getText();
  const typeText = type.getText(node, ts.TypeFormatFlags.NoTruncation);
  const displayString = `(${node.getKindName()}) ${symbolName}: ${typeText}`;

  const tags = symbol
    ? symbol.getJsDocTags(checker).map((t) => ({
        name: t.name,
        text: ts.displayPartsToString(t.text),
      }))
    : [];

  return {
    displayString,
    documentation: docText(checker, node),
    tags,
    file,
    line,
    column: col,
  };
}

export function typeDiagnostics(file?: string, tsconfig?: string): Diagnostic[] {
  const project = getProject(tsconfig);
  const raw = file
    ? getSourceFile(project, file).getPreEmitDiagnostics()
    : project.getPreEmitDiagnostics();

  const catMap: Record<number, Diagnostic["category"]> = {
    [ts.DiagnosticCategory.Error]: "error",
    [ts.DiagnosticCategory.Warning]: "warning",
    [ts.DiagnosticCategory.Suggestion]: "suggestion",
    [ts.DiagnosticCategory.Message]: "message",
  };

  return raw.map((d) => ({
    file: d.getSourceFile()?.getFilePath() ?? "<unknown>",
    line: d.getLineNumber() ?? 0,
    column: 0,
    message: flattenMsg(d.getMessageText()),
    code: d.getCode(),
    category: catMap[d.getCategory()] ?? "error",
  }));
}

function docText(checker: ts.TypeChecker, node: Node): string | null {
  const symbol = checker.getSymbolAtLocation(node.compilerNode);
  if (!symbol) return null;
  const text = ts.displayPartsToString(symbol.getDocumentationComment(checker));
  return text || null;
}

function flattenMsg(msg: string | DiagnosticMessageChain): string {
  if (typeof msg === "string") return msg;
  let result = msg.getMessageText();
  const next = msg.getNext();
  if (next) {
    for (const n of next) result += "\n  " + flattenMsg(n);
  }
  return result;
}
