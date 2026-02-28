import { NextRequest, NextResponse } from "next/server";
import { readFile, getMimeType, StorageError } from "@/lib/storage/local";
import { getCurrentUserId } from "@/lib/auth/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { path: pathSegments } = await params;
    const filePath = pathSegments.join("/");

    const pathParts = filePath.split("/");
    if (pathParts.length < 3) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    const fileUserId = pathParts[0];
    if (fileUserId !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const fileBuffer = await readFile(filePath);
    const mimeType = getMimeType(filePath);

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("File serve error:", error);
    if (error instanceof StorageError) {
      if (error.code === "not_found") {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      if (error.code === "permission_denied" || error.code === "invalid_path") {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { path: pathSegments } = await params;
    const filePath = pathSegments.join("/");

    const pathParts = filePath.split("/");
    if (pathParts.length < 3) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    const fileUserId = pathParts[0];
    if (fileUserId !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { deleteFile } = await import("@/lib/storage/local");
    await deleteFile(filePath);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("File delete error:", error);
    if (error instanceof StorageError) {
      if (error.code === "not_found") {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
    }
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
