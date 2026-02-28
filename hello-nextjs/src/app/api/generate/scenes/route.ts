import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import { getProjectById, updateProjectStage } from "@/lib/db/projects";
import { storyToScenes, isVolcTextConfigured } from "@/lib/ai/volc-text";
import { createScenes, deleteScenesByProjectId } from "@/lib/db/scenes";

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isVolcTextConfigured()) {
      return NextResponse.json(
        { error: "Text generation model is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { projectId } = body;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    const project = await getProjectById(projectId, userId);

    if (!project.story) {
      return NextResponse.json(
        { error: "Project has no story content" },
        { status: 400 }
      );
    }

    const scenes = await storyToScenes(project.story, project.style ?? undefined);

    await deleteScenesByProjectId(projectId);
    await createScenes(projectId, scenes);

    await updateProjectStage(projectId, userId, "scenes");

    return NextResponse.json({
      scenes,
      count: scenes.length,
    });
  } catch (error) {
    console.error("Error generating scenes:", error);
    return NextResponse.json(
      { error: "Failed to generate scenes" },
      { status: 500 }
    );
  }
}
