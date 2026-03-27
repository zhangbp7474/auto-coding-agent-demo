import { NextRequest, NextResponse } from 'next/server';
import { getPathFinder, SearchOptions } from '@/lib/dev-sync/path-finder';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Path finder is disabled in production' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const element: SearchOptions = {
      text: body.text,
      className: body.className,
      id: body.id,
      tagName: body.tagName,
      placeholder: body.placeholder,
      href: body.href,
      src: body.src
    };

    const pathFinder = getPathFinder();
    const matches = pathFinder.findMatchingFiles(element);
    const suggestedPath = pathFinder.suggestBestPath(element);

    return NextResponse.json({
      success: true,
      suggestedPath,
      matches: matches.slice(0, 10),
      totalMatches: matches.length,
      element: element,
      debug: {
        cacheSize: pathFinder.getCacheSize(),
        projectRoot: pathFinder.getProjectRoot()
      }
    });

  } catch (error: any) {
    console.error('[PathFinder API] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ enabled: false });
  }

  const action = request.nextUrl.searchParams.get('action');

  try {
    const pathFinder = getPathFinder();

    if (action === 'structure') {
      const structure = pathFinder.getProjectStructure();
      return NextResponse.json({
        enabled: true,
        structure,
        debug: {
          cacheSize: pathFinder.getCacheSize(),
          projectRoot: pathFinder.getProjectRoot()
        }
      });
    }

    if (action === 'suggest') {
      const query = request.nextUrl.searchParams.get('q') || '';
      const suggestions = pathFinder.getFileSuggestions(query);
      return NextResponse.json({
        suggestions
      });
    }

    if (action === 'refresh') {
      pathFinder.refreshCache();
      return NextResponse.json({
        success: true,
        message: 'Cache refreshed',
        cacheSize: pathFinder.getCacheSize()
      });
    }

    return NextResponse.json({
      enabled: true,
      message: 'Path finder API',
      cacheSize: pathFinder.getCacheSize(),
      projectRoot: pathFinder.getProjectRoot(),
      endpoints: {
        POST: '/api/dev-sync/find-path - Find source file path by element',
        'GET ?action=structure': 'Get project structure',
        'GET ?action=suggest&q=xxx': 'Get path suggestions',
        'GET ?action=refresh': 'Refresh file cache'
      }
    });

  } catch (error: any) {
    console.error('[PathFinder API] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
