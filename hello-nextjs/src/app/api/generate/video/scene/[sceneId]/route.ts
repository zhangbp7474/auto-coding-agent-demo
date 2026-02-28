import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import { getSceneById, updateSceneVideoStatus } from "@/lib/db/scenes";
import { getProjectById } from "@/lib/db/projects";
import { getLatestImageBySceneId, createProcessingVideo, getSignedUrl } from "@/lib/db/media";
import {
  createVideoTask,
  isVolcVideoConfigured,
  VolcVideoApiError,
} from "@/lib/ai/volc-video";

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

    if (!isVolcVideoConfigured()) {
      return NextResponse.json(
        { error: "Video generation service is not configured. Please set VOLC_API_KEY." },
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

    await getProjectById(projectId, userId);
    const scene = await getSceneById(sceneId);

    if (scene.project_id !== projectId) {
      return NextResponse.json(
        { error: "Scene does not belong to this project" },
        { status: 400 }
      );
    }

    if (scene.image_status !== "completed") {
      return NextResponse.json(
        { error: "Scene image must be completed before generating video" },
        { status: 400 }
      );
    }

    const latestImage = await getLatestImageBySceneId(sceneId);

    if (!latestImage) {
      return NextResponse.json(
        { error: "No image found for this scene. Please generate an image first." },
        { status: 400 }
      );
    }

    const imageUrl = await getSignedUrl(latestImage.storage_path, 3600);

    await updateSceneVideoStatus(sceneId, "processing");

    try {
      const task = await createVideoTask(
        imageUrl,
        scene.description,
        {
          duration: 5,
          watermark: false,
        }
      );

      const video = await createProcessingVideo(sceneId, task.taskId);

      return NextResponse.json({
        success: true,
        taskId: task.taskId,
        videoId: video.id,
        sceneId,
        status: task.status,
        message: "Video task created successfully",
      });
    } catch (generationError) {
      await updateSceneVideoStatus(sceneId, "failed");
      throw generationError;
    }
  } catch (error) {
    console.error("Error creating video task:", error);

    if (error instanceof VolcVideoApiError) {
      return NextResponse.json(
        { error: `Video generation error: ${error.message}` },
        { status: 502 }
      );
    }

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to create video task" },
      { status: 500 }
    );
  }
}
