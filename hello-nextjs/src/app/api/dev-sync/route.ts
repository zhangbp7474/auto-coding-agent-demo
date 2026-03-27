import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

interface Modification {
  type: string;
  devId?: string;
  devPath?: string;
  element: {
    tagName: string;
    id?: string;
    className?: string;
    textContent?: string;
    value?: string;
    attributes: Record<string, string>;
    [key: string]: any;
  };
  timestamp: number;
}

interface SyncRequest {
  modifications: Modification[];
  url: string;
  timestamp: number;
}

const PROJECT_ROOT = path.join(process.cwd(), 'src');

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, error: 'Dev sync is disabled in production' },
      { status: 403 }
    );
  }

  try {
    const body: SyncRequest = await request.json();
    const { modifications } = body;

    if (!modifications || modifications.length === 0) {
      return NextResponse.json({ success: true, modified: 0 });
    }

    const results = [];
    let modifiedCount = 0;

    for (const mod of modifications) {
      const filePath = mod.devPath;

      if (!filePath) {
        results.push({ devId: mod.devId, success: false, error: 'No file path specified' });
        continue;
      }

      try {
        const fullPath = path.join(PROJECT_ROOT, filePath);
        const result = await applyModification(fullPath, mod);
        results.push(result);

        if (result.success) {
          modifiedCount++;
        }
      } catch (error: any) {
        results.push({
          devId: mod.devId,
          success: false,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      modified: modifiedCount,
      results,
      message: modifiedCount > 0 ? 'Files updated successfully' : 'No files were modified'
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function applyModification(filePath: string, mod: Modification): Promise<any> {
  if (!fs.existsSync(filePath)) {
    return { devId: mod.devId, success: false, error: `File not found: ${filePath}` };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const ext = path.extname(filePath);

  let modifiedContent = content;
  let changed = false;

  if (ext === '.tsx' || ext === '.jsx') {
    modifiedContent = await applyReactModification(content, mod);
  } else if (ext === '.ts' || ext === '.js') {
    modifiedContent = await applyJSModification(content, mod);
  } else if (ext === '.css' || ext === '.scss') {
    modifiedContent = applyCSSModification(content, mod);
  } else if (ext === '.json') {
    modifiedContent = applyJSONModification(content, mod);
  } else {
    return {
      devId: mod.devId,
      success: false,
      error: `Unsupported file type: ${ext}`
    };
  }

  if (modifiedContent !== content) {
    fs.writeFileSync(filePath, modifiedContent, 'utf-8');
    changed = true;
  }

  return {
    devId: mod.devId,
    success: changed,
    file: filePath,
    message: changed ? 'File modified successfully' : 'No changes needed'
  };
}

async function applyReactModification(content: string, mod: Modification): Promise<string> {
  const element = mod.element;
  const attrs = element.attributes;

  if (mod.type === 'attributes') {
    if (attrs.class) {
      const classMatch = content.match(/className=["']([^"']*)["']/g);
      if (classMatch) {
        const newClassName = attrs.class.replace('className=', '').replace(/["']/g, '');
        content = content.replace(/className=["'][^"']*["']/g, `className="${newClassName}"`);
      } else {
        const tagMatch = content.match(new RegExp(`<(${element.tagName.toLowerCase()})([^>]*)>`));
        if (tagMatch) {
          const tag = tagMatch[1];
          const existingAttrs = tagMatch[2];
          content = content.replace(
            tagMatch[0],
            `<${tag}${existingAttrs} className="${newClassName}">`
          );
        }
      }
    }

    if (element.textContent && attrs['data-dev-id']) {
      const devId = attrs['data-dev-id'];
      const textMatch = content.match(new RegExp(`(<[^>]*${devId}[^>]*>)([^<]*)(</)`));
      if (textMatch) {
        const cleanText = element.textContent.trim();
        content = content.replace(
          textMatch[0],
          `${textMatch[1]}${cleanText}${textMatch[3]}`
        );
      }
    }

    if (element.value && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
      const placeholderMatch = content.match(/placeholder=["']([^"']*)["']/g);
      if (placeholderMatch) {
        const newPlaceholder = element.value;
        content = content.replace(/placeholder=["'][^"']*["']/g, `placeholder="${newPlaceholder}"`);
      }
    }
  }

  if (element.innerHTML && mod.type === 'childList') {
    const cleanedHTML = element.innerHTML
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');

    if (attrs['data-dev-id']) {
      const devId = attrs['data-dev-id'];
      const componentMatch = content.match(new RegExp(`(<[^>]*${devId}[^>]*>)([\\s\\S]*?)(</)`));
      if (componentMatch) {
        content = content.replace(
          componentMatch[0],
          `${componentMatch[1]}${cleanedHTML}${componentMatch[3]}`
        );
      }
    }
  }

  return content;
}

async function applyJSModification(content: string, mod: Modification): Promise<string> {
  const element = mod.element;

  if (mod.type === 'attributes' && element.textContent) {
    const stringMatch = content.match(/["']([^"']*)["'](?=\s*\+?\s*$)/m);
    if (stringMatch) {
      const newValue = element.textContent.trim();
      content = content.replace(
        stringMatch[0],
        `"${newValue}"`
      );
    }
  }

  return content;
}

function applyCSSModification(content: string, mod: Modification): string {
  const attrs = element.attributes;

  if (mod.type === 'attributes' && attrs.class) {
    const className = attrs.class.replace('className=', '').replace(/["']/g, '').trim();

    const cssSelector = `.${className}`;
    const existingRule = content.match(new RegExp(`${cssSelector}\\s*\\{([^}]*)\\}`));

    if (existingRule) {
      return content;
    }

    const newCSS = `
${cssSelector} {
  /* Auto-generated from browser modification */
}

`;
    return content + newCSS;
  }

  return content;
}

function applyJSONModification(content: string, mod: Modification): string {
  try {
    const json = JSON.parse(content);

    if (element.textContent) {
      const key = mod.devId?.replace('element-', 'key');
      if (key && json[key] !== undefined) {
        json[key] = element.textContent.trim();
        return JSON.stringify(json, null, 2);
      }
    }

    return content;
  } catch {
    return content;
  }
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ enabled: false });
  }

  const componentPath = request.nextUrl.searchParams.get('path');

  if (!componentPath) {
    return NextResponse.json({
      enabled: true,
      message: 'Dev sync API is active',
      endpoints: {
        POST: '/api/dev-sync - Submit modifications',
        GET: '/api/dev-sync?path=xxx - Get component info'
      }
    });
  }

  const fullPath = path.join(PROJECT_ROOT, componentPath);

  if (!fs.existsSync(fullPath)) {
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    );
  }

  const content = fs.readFileSync(fullPath, 'utf-8');

  return NextResponse.json({
    path: componentPath,
    size: content.length,
    lines: content.split('\n').length,
    preview: content.substring(0, 500)
  });
}
