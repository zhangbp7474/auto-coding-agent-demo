import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import { getSceneById, updateSceneImageStatus } from "@/lib/db/scenes";
import { getProjectById } from "@/lib/db/projects";
import { createImage, deleteImagesBySceneId } from "@/lib/db/media";
import {
  generateImageBuffer,
  isVolcImageConfigured,
  VolcImageApiError,
} from "@/lib/ai/volc-image";

interface RouteParams {
  params: Promise<{ sceneId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sceneId } = await params;

    if (!isVolcImageConfigured()) {
      return NextResponse.json(
        { error: "Image generation service is not configured. Please set VOLC_API_KEY." },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { projectId } = body;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    const project = await getProjectById(projectId, userId);
    const scene = await getSceneById(sceneId);

    if (scene.project_id !== projectId) {
      return NextResponse.json(
        { error: "Scene does not belong to this project" },
        { status: 400 }
      );
    }

    if (!scene.description_confirmed) {
      return NextResponse.json(
        { error: "Scene description must be confirmed before generating image" },
        { status: 400 }
      );
    }

    await updateSceneImageStatus(sceneId, "processing");

    try {
      const imageBuffer = await generateImageBuffer(
        scene.description,
        project.style ?? undefined,
        { size: "2K" }
      );

      await deleteImagesBySceneId(sceneId);

      const image = await createImage(sceneId, userId, projectId, imageBuffer, {
        width: 1024,
        height: 1024,
      });

      const updatedScene = await updateSceneImageStatus(sceneId, "completed");

      return NextResponse.json({
        success: true,
        image,
        scene: updatedScene,
        message: "Image generated successfully",
      });
    } catch (generationError) {
      await updateSceneImageStatus(sceneId, "failed");
      throw generationError;
    }
  } catch (error) {
    console.error("Error generating image:", error);

    if (error instanceof VolcImageApiError) {
      console.error("VolcImageApiError details:", {
        message: error.message,
        statusCode: error.statusCode,
        errorCode: error.errorCode
      });
      return NextResponse.json(
        {
          error: `Image generation error: ${error.message}`,
          details: {
            statusCode: error.statusCode,
            errorCode: error.errorCode
          }
        },
        { status: 502 }
      );
    }

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Unexpected error:", errorMessage, error);

    return NextResponse.json(
      { error: `Failed to generate image: ${errorMessage}` },
      { status: 500 }
    );
  }
}
