import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import { confirmAllDescriptions, SceneError } from "@/lib/db/scenes";
import { isProjectOwner } from "@/lib/db/projects";

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const isOwner = await isProjectOwner(projectId, userId);
    if (!isOwner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const count = await confirmAllDescriptions(projectId);

    return NextResponse.json({ count });
  } catch (error) {
    if (error instanceof SceneError) {
      if (error.code === "not_found") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }
    console.error("Error confirming all descriptions:", error);
    return NextResponse.json(
      { error: "Failed to confirm all descriptions" },
      { status: 500 }
    );
  }
}
