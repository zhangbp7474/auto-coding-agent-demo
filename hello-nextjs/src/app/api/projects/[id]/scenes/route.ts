import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import { getProjectById } from "@/lib/db/projects";
import { getScenesByProjectId } from "@/lib/db/scenes";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    const project = await getProjectById(projectId, userId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const scenes = await getScenesByProjectId(projectId);

    return NextResponse.json({ scenes });
  } catch (error) {
    console.error("Error fetching scenes:", error);
    return NextResponse.json(
      { error: "Failed to fetch scenes" },
      { status: 500 }
    );
  }
}
