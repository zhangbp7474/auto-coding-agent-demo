import * as fs from 'fs';
import * as path from 'path';

export interface SourceFile {
  path: string;
  content: string;
  lines: string[];
  ast?: any;
}

export interface ComponentInfo {
  name: string;
  filePath: string;
  line: number;
  attributes: string[];
  children: string[];
}

export interface DOMMarker {
  id: string;
  path: string;
  selector: string;
  attributes: Record<string, string>;
  lastModified: number;
}

export class SourceAnalyzer {
  private markers: Map<string, DOMMarker> = new Map();
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.loadMarkers();
  }

  private loadMarkers() {
    const markerFile = path.join(this.projectRoot, '.dev-markers.json');

    if (fs.existsSync(markerFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(markerFile, 'utf-8'));
        Object.entries(data).forEach(([id, marker]) => {
          this.markers.set(id, marker as DOMMarker);
        });
      } catch (error) {
        console.error('Failed to load markers:', error);
      }
    }
  }

  saveMarkers() {
    const markerFile = path.join(this.projectRoot, '.dev-markers.json');
    const data: Record<string, DOMMarker> = {};

    this.markers.forEach((marker, id) => {
      data[id] = marker;
    });

    fs.writeFileSync(markerFile, JSON.stringify(data, null, 2));
  }

  registerMarker(marker: DOMMarker) {
    this.markers.set(marker.id, marker);
    this.saveMarkers();
  }

  getMarker(id: string): DOMMarker | undefined {
    return this.markers.get(id);
  }

  getAllMarkers(): DOMMarker[] {
    return Array.from(this.markers.values());
  }

  async analyzeFile(filePath: string): Promise<SourceFile> {
    const fullPath = path.join(this.projectRoot, filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    return {
      path: filePath,
      content,
      lines
    };
  }

  findComponentInFile(file: SourceFile, searchTerm: string): ComponentInfo | null {
    const lines = file.lines;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes(searchTerm) || line.includes(`id="${searchTerm}"`)) {
        return {
          name: this.extractComponentName(line, lines, i),
          filePath: file.path,
          line: i + 1,
          attributes: this.extractAttributes(line),
          children: this.extractChildren(lines, i)
        };
      }
    }

    return null;
  }

  private extractComponentName(line: string, lines: string[], startLine: number): string {
    const match = line.match(/function\s+(\w+)|const\s+(\w+)\s*=|class\s+(\w+)/);
    if (match) {
      return match[1] || match[2] || match[3];
    }

    const tagMatch = line.match(/<(\w+)/);
    if (tagMatch) {
      return tagMatch[1];
    }

    return `Component at line ${startLine + 1}`;
  }

  private extractAttributes(line: string): string[] {
    const attrs: string[] = [];
    const attrRegex = /(\w+)=["'][^"']*["']/g;
    let match;

    while ((match = attrRegex.exec(line)) !== null) {
      attrs.push(match[1]);
    }

    return attrs;
  }

  private extractChildren(lines: string[], startLine: number): string[] {
    const children: string[] = [];
    const maxLines = Math.min(startLine + 50, lines.length);
    let openTags = 0;
    let closeTags = 0;

    for (let i = startLine; i < maxLines; i++) {
      const line = lines[i];
      openTags += (line.match(/</g) || []).length;
      closeTags += (line.match(/<\//g) || []).length;

      if (i > startLine && openTags > 0 && openTags === closeTags) {
        break;
      }
    }

    return children;
  }

  async modifySource(
    filePath: string,
    markerId: string,
    modifications: Record<string, any>
  ): Promise<boolean> {
    const marker = this.markers.get(markerId);

    if (!marker) {
      console.error(`Marker not found: ${markerId}`);
      return false;
    }

    const fullPath = path.join(this.projectRoot, filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Source file not found: ${fullPath}`);
    }

    let content = fs.readFileSync(fullPath, 'utf-8');
    const ext = path.extname(filePath);

    if (ext === '.tsx' || ext === '.jsx') {
      content = this.modifyReactSource(content, marker, modifications);
    } else if (ext === '.css' || ext === '.scss') {
      content = this.modifyCSSSource(content, marker, modifications);
    } else if (ext === '.js' || ext === '.ts') {
      content = this.modifyJSSource(content, marker, modifications);
    }

    fs.writeFileSync(fullPath, content, 'utf-8');
    marker.lastModified = Date.now();
    this.saveMarkers();

    return true;
  }

  private modifyReactSource(
    content: string,
    marker: DOMMarker,
    mods: Record<string, any>
  ): string {
    const selector = marker.selector;

    if (mods.className) {
      const classNameRegex = /className=["'][^"']*["']/g;
      if (classNameRegex.test(content)) {
        content = content.replace(classNameRegex, `className="${mods.className}"`);
      } else {
        content = content.replace(
          /<([A-Z]\w*)/,
          `<$1 className="${mods.className}"`
        );
      }
    }

    if (mods.text) {
      const textRegex = new RegExp(`>${marker.attributes.text || '[^<]+'}<`, 'g');
      content = content.replace(textRegex, `>${mods.text}<`);
    }

    if (mods.placeholder) {
      const placeholderRegex = /placeholder=["'][^"']*["']/g;
      if (placeholderRegex.test(content)) {
        content = content.replace(placeholderRegex, `placeholder="${mods.placeholder}"`);
      }
    }

    if (mods.src) {
      const srcRegex = /src=["'][^"']*["']/g;
      if (srcRegex.test(content)) {
        content = content.replace(srcRegex, `src="${mods.src}"`);
      }
    }

    return content;
  }

  private modifyCSSSource(
    content: string,
    marker: DOMMarker,
    mods: Record<string, any>
  ): string {
    const selector = marker.selector.replace('.', '');

    if (mods.color) {
      content += `\n.${selector} { color: ${mods.color}; }`;
    }

    if (mods.backgroundColor) {
      content += `\n.${selector} { background-color: ${mods.backgroundColor}; }`;
    }

    if (mods.fontSize) {
      content += `\n.${selector} { font-size: ${mods.fontSize}; }`;
    }

    return content;
  }

  private modifyJSSource(
    content: string,
    marker: DOMMarker,
    mods: Record<string, any>
  ): string {
    if (mods.value) {
      const stringMatch = content.match(/["'][^"']*["']/);
      if (stringMatch) {
        content = content.replace(stringMatch[0], `"${mods.value}"`);
      }
    }

    return content;
  }

  generateDiff(original: string, modified: string): string {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    const diff: string[] = [];

    const maxLines = Math.max(originalLines.length, modifiedLines.length);

    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i];
      const modLine = modifiedLines[i];

      if (origLine === modLine) {
        diff.push(`  ${origLine || ''}`);
      } else {
        if (origLine !== undefined) {
          diff.push(`- ${origLine}`);
        }
        if (modLine !== undefined) {
          diff.push(`+ ${modLine}`);
        }
      }
    }

    return diff.join('\n');
  }
}

export const sourceAnalyzer = new SourceAnalyzer();
