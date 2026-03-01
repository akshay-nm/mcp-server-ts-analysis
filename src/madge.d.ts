declare module "madge" {
  interface MadgeConfig {
    baseDir?: string;
    includeNpm?: boolean;
    fileExtensions?: string[];
    excludeRegExp?: RegExp[];
    requireConfig?: string;
    webpackConfig?: string;
    tsConfig?: string | object;
    detectiveOptions?: object;
    dependencyFilter?: (filepath: string, traversedPath: string, baseDir: string) => boolean;
  }

  interface MadgeInstance {
    obj(): { [module: string]: string[] };
    circular(): string[][];
    circularGraph(): { [module: string]: string[] };
    depends(moduleId: string): string[];
    orphans(): string[];
    leaves(): string[];
    warnings(): { skipped: string[] };
    dot(circularOnly?: boolean): Promise<string>;
    image(imagePath: string, circularOnly?: boolean): Promise<string>;
    svg(): Promise<Buffer>;
  }

  function madge(path: string | string[], config?: MadgeConfig): Promise<MadgeInstance>;

  export { MadgeConfig, MadgeInstance };
  export default madge;
}
