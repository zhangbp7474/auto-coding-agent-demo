import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import { getProjectById, updateProjectStage } from "@/lib/db/projects";
import { storyToScenes, isVolcTextConfigured, VolcTextApiError } from "@/lib/ai/volc-text";
import { createScenes, deleteScenesByProjectId } from "@/lib/db/scenes";

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isVolcTextConfigured()) {
      return NextResponse.json(
        { error: "Text generation service is not configured. Please set VOLC_API_KEY." },
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
        { error: "Project has no story content. Please add a story first." },
        { status: 400 }
      );
    }

    console.log("[Generate Scenes] Starting scene generation for project:", projectId);
    console.log("[Generate Scenes] Story:", project.story.substring(0, 100) + "...");
    console.log("[Generate Scenes] Style:", project.style);

    const scenes = await storyToScenes(project.story, project.style ?? undefined);

    console.log("[Generate Scenes] Generated", scenes.length, "scenes successfully");

    await deleteScenesByProjectId(projectId);
    await createScenes(projectId, scenes);

    await updateProjectStage(projectId, userId, "scenes");

    return NextResponse.json({
      scenes,
      count: scenes.length,
    });
  } catch (error) {
    console.error("[Generate Scenes] Error:", error);

    if (error instanceof VolcTextApiError) {
      console.error("[Generate Scenes] VolcTextApiError:", {
        message: error.message,
        statusCode: error.statusCode,
        errorCode: error.errorCode
      });

      if (error.statusCode === 401 || error.statusCode === 403) {
        return NextResponse.json(
          { error: "Invalid API key. Please check your VOLC_API_KEY configuration." },
          { status: 401 }
        );
      }

      if (error.message.includes("does not exist") || error.message.includes("not exist")) {
        return NextResponse.json(
          { error: `Model not available: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: "AI service error: " + error.message },
        { status: 500 }
      );
    }

    if (error instanceof Error) {
      console.error("[Generate Scenes] Error name:", error.name);
      console.error("[Generate Scenes] Error message:", error.message);
      console.error("[Generate Scenes] Error stack:", error.stack);
    }

    return NextResponse.json(
      { error: "Failed to generate scenes: " + (error instanceof Error ? error.message : "Unknown error") },
      { status: 500 }
    );
  }
}
