import * as fs from 'fs';
import * as path from 'path';

export interface SearchOptions {
  text?: string;
  className?: string;
  id?: string;
  tagName?: string;
  placeholder?: string;
  href?: string;
  src?: string;
}

export interface FileMatch {
  filePath: string;
  lineNumber: number;
  matchType: string;
  confidence: number;
  matchedContent: string;
  context: string;
}

export class SourcePathFinder {
  private projectRoot: string;
  private fileCache: Map<string, string> = new Map();
  private initialized: boolean = false;

  constructor(projectRoot?: string) {
    if (projectRoot) {
      this.projectRoot = projectRoot;
    } else {
      this.projectRoot = this.findProjectRoot();
    }
    this.buildFileCache();
    this.initialized = true;
  }

  private findProjectRoot(): string {
    let cwd = process.cwd();
    
    const checkDirs = [
      cwd,
      path.join(cwd, 'hello-nextjs'),
      path.join(cwd, '..', 'hello-nextjs'),
      path.join(__dirname, '..', '..', '..', '..', '..'),
    ];

    for (const dir of checkDirs) {
      const packageJson = path.join(dir, 'package.json');
      const srcDir = path.join(dir, 'src');
      
      if (fs.existsSync(packageJson) && fs.existsSync(srcDir)) {
        return dir;
      }
    }

    return cwd;
  }

  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  private buildFileCache() {
    const srcDir = path.join(this.projectRoot, 'src');
    
    console.log('[PathFinder] Scanning directory:', srcDir);
    
    if (!fs.existsSync(srcDir)) {
      console.log('[PathFinder] src directory not found');
      return;
    }

    let fileCount = 0;

    const scanDir = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            scanDir(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (['.tsx', '.jsx', '.ts', '.js', '.css', '.scss'].includes(ext)) {
              try {
                const relativePath = this.normalizePath(path.relative(this.projectRoot, fullPath));
                const content = fs.readFileSync(fullPath, 'utf-8');
                this.fileCache.set(relativePath, content);
                fileCount++;
              } catch (error) {
                console.log('[PathFinder] Error reading file:', fullPath, error);
              }
            }
          }
        }
      } catch (error) {
        console.log('[PathFinder] Error scanning directory:', dir, error);
      }
    };

    scanDir(srcDir);
    console.log(`[PathFinder] Loaded ${fileCount} files`);
  }

  refreshCache() {
    this.fileCache.clear();
    this.buildFileCache();
  }

  findMatchingFiles(element: SearchOptions): FileMatch[] {
    const matches: FileMatch[] = [];

    for (const [filePath, content] of this.fileCache.entries()) {
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;
        
        const match = this.analyzeLine(line, filePath, lineNumber, element);
        if (match) {
          matches.push(match);
        }
      }
    }

    matches.sort((a, b) => b.confidence - a.confidence);
    return matches;
  }

  private analyzeLine(
    line: string,
    filePath: string,
    lineNumber: number,
    element: SearchOptions
  ): FileMatch | null {
    let confidence = 0;
    let matchType = '';
    let matchedContent = '';

    if (element.text && element.text.trim()) {
      const searchText = element.text.trim().substring(0, 50);
      if (line.includes(searchText)) {
        confidence += 40;
        matchType = 'text';
        matchedContent = searchText;
      }
    }

    if (element.className) {
      const classNames = element.className.split(' ').filter(c => c.length > 2);
      for (const className of classNames) {
        if (line.includes(className)) {
          confidence += 30;
          if (!matchType) {
            matchType = 'className';
            matchedContent = className;
          }
        }
      }
    }

    if (element.id && line.includes(`id="${element.id}"`)) {
      confidence += 50;
      matchType = 'id';
      matchedContent = `id="${element.id}"`;
    }

    if (element.placeholder && line.includes(`placeholder="${element.placeholder}"`)) {
      confidence += 40;
      matchType = 'placeholder';
      matchedContent = `placeholder="${element.placeholder}"`;
    }

    if (element.tagName) {
      const tagLower = element.tagName.toLowerCase();
      if (line.includes(`<${tagLower}`) || line.includes(`<${tagLower} `)) {
        confidence += 20;
        if (!matchType) {
          matchType = 'tagName';
          matchedContent = `<${tagLower}>`;
        }
      }
    }

    if (element.href && line.includes(`href="${element.href}"`)) {
      confidence += 35;
      matchType = 'href';
      matchedContent = `href="${element.href}"`;
    }

    if (element.src && line.includes(`src="${element.src}"`)) {
      confidence += 35;
      matchType = 'src';
      matchedContent = `src="${element.src}"`;
    }

    if (confidence > 0) {
      const contextStart = Math.max(0, lineNumber - 2);
      const contextEnd = Math.min(lines.length, lineNumber + 2);
      const context = lines.slice(contextStart, contextEnd).join('\n');

      return {
        filePath,
        lineNumber,
        matchType,
        confidence,
        matchedContent,
        context
      };
    }

    return null;
  }

  suggestBestPath(element: SearchOptions): string | null {
    const matches = this.findMatchingFiles(element);
    
    if (matches.length === 0) {
      return this.suggestByPageContext(element);
    }

    const bestMatch = matches[0];
    
    if (bestMatch.confidence >= 30) {
      return bestMatch.filePath;
    }

    if (matches.length > 0 && matches[0].confidence >= 20) {
      return matches[0].filePath;
    }

    return null;
  }

  private suggestByPageContext(element: SearchOptions): string | null {
    if (element.tagName) {
      const tagLower = element.tagName.toLowerCase();
      
      const tagToPath: Record<string, string[]> = {
        'header': ['src/components/layout/Header.tsx', 'src/components/Header.tsx'],
        'footer': ['src/components/layout/Footer.tsx', 'src/components/Footer.tsx'],
        'nav': ['src/components/Navigation.tsx', 'src/components/layout/Nav.tsx'],
        'main': ['src/app/page.tsx', 'src/app/layout.tsx'],
        'section': ['src/app/page.tsx'],
        'div': ['src/app/page.tsx'],
        'form': ['src/components/forms/*.tsx', 'src/app/**/page.tsx'],
        'input': ['src/components/forms/*.tsx', 'src/app/**/page.tsx'],
        'button': ['src/app/**/page.tsx', 'src/components/**/*.tsx'],
        'img': ['src/app/page.tsx', 'src/components/**/*.tsx'],
      };

      const suggestions = tagToPath[tagLower];
      if (suggestions && suggestions.length > 0) {
        return suggestions[0];
      }
    }

    return 'src/app/page.tsx';
  }

  getProjectStructure(): Record<string, string[]> {
    const structure: Record<string, string[]> = {
      pages: [],
      components: [],
      layouts: [],
      api: [],
      lib: [],
      hooks: [],
      styles: []
    };

    for (const filePath of this.fileCache.keys()) {
      const normalizedPath = this.normalizePath(filePath);
      
      if (normalizedPath.includes('/app/') && !normalizedPath.includes('/api/')) {
        structure.pages.push(normalizedPath);
      } else if (normalizedPath.includes('/components/')) {
        structure.components.push(normalizedPath);
      } else if (normalizedPath.includes('/app/layout')) {
        structure.layouts.push(normalizedPath);
      } else if (normalizedPath.includes('/api/')) {
        structure.api.push(normalizedPath);
      } else if (normalizedPath.includes('/lib/')) {
        structure.lib.push(normalizedPath);
      } else if (normalizedPath.includes('/hooks/')) {
        structure.hooks.push(normalizedPath);
      } else if (normalizedPath.match(/\.(css|scss)$/)) {
        structure.styles.push(normalizedPath);
      }
    }

    structure.pages.sort();
    structure.components.sort();
    structure.layouts.sort();
    structure.api.sort();
    structure.lib.sort();
    structure.styles.sort();

    return structure;
  }

  getFileSuggestions(partialPath: string): string[] {
    const suggestions: string[] = [];
    const lower = partialPath.toLowerCase();

    for (const filePath of this.fileCache.keys()) {
      if (this.normalizePath(filePath).toLowerCase().includes(lower)) {
        suggestions.push(filePath);
      }
    }

    return suggestions.slice(0, 10);
  }

  getCacheSize(): number {
    return this.fileCache.size;
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }
}

let pathFinderInstance: SourcePathFinder | null = null;

export function getPathFinder(): SourcePathFinder {
  if (!pathFinderInstance) {
    pathFinderInstance = new SourcePathFinder();
  }
  return pathFinderInstance;
}

export const pathFinder = new SourcePathFinder();
