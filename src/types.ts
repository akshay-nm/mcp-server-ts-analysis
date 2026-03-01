export interface TypeInfo {
  type: string;
  symbol: string | null;
  documentation: string | null;
  file: string;
  line: number;
  column: number;
}

export interface HoverInfo {
  displayString: string;
  documentation: string | null;
  tags: { name: string; text: string }[];
  file: string;
  line: number;
  column: number;
}

export interface Diagnostic {
  file: string;
  line: number;
  column: number;
  message: string;
  code: number;
  category: "error" | "warning" | "suggestion" | "message";
}

export interface DepGraph {
  [file: string]: string[];
}

export interface ImportChain {
  found: boolean;
  path: string[];
}
