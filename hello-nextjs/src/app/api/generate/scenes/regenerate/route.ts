import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import { getProjectById, updateProjectStage } from "@/lib/db/projects";
import {
  createScenes,
  deleteScenesByProjectId,
  getScenesByProjectId,
} from "@/lib/db/scenes";
import {
  regenerateScenes,
  isVolcTextConfigured,
  VolcTextApiError,
} from "@/lib/ai/volc-text";

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isVolcTextConfigured()) {
      return NextResponse.json(
        { error: "AI service is not configured. Please set VOLC_API_KEY." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { projectId, feedback } = body;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    const project = await getProjectById(projectId, userId);

    if (!project.story) {
      return NextResponse.json(
        { error: "Project has no story content. Please add a story first." },
        { status: 400 }
      );
    }

    const existingScenes = await getScenesByProjectId(projectId);
    const previousSceneDescriptions = existingScenes.map((scene) => ({
      order_index: scene.order_index,
      description: scene.description,
    }));

    const sceneDescriptions = await regenerateScenes(
      project.story,
      project.style ?? undefined,
      previousSceneDescriptions.length > 0 ? previousSceneDescriptions : undefined,
      feedback
    );

    if (sceneDescriptions.length === 0) {
      return NextResponse.json(
        { error: "Failed to regenerate scenes. Please try again." },
        { status: 500 }
      );
    }

    await deleteScenesByProjectId(projectId);
    const newScenes = await createScenes(projectId, sceneDescriptions);
    await updateProjectStage(projectId, userId, "scenes");

    return NextResponse.json({
      success: true,
      scenes: newScenes,
      message: `Successfully regenerated ${newScenes.length} scenes`,
    });
  } catch (error) {
    console.error("Error regenerating scenes:", error);

    if (error instanceof VolcTextApiError) {
      return NextResponse.json(
        { error: `AI service error: ${error.message}` },
        { status: 502 }
      );
    }

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to regenerate scenes" },
      { status: 500 }
    );
  }
}
