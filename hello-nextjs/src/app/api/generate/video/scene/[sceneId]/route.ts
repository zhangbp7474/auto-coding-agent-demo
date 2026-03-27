import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import { getSceneById, updateSceneVideoStatus } from "@/lib/db/scenes";
import { getProjectById } from "@/lib/db/projects";
import { getLatestImageBySceneId, createProcessingVideo } from "@/lib/db/media";
import { readFile, StorageError } from "@/lib/storage/local";
import {
  createVideoTask,
  isVolcVideoConfigured,
  VolcVideoApiError,
} from "@/lib/ai/volc-video";

interface RouteParams {
  params: Promise<{ sceneId: string }>;
}

async function getImageAsBase64(storagePath: string): Promise<string> {
  try {
    const fileBuffer = await readFile(storagePath);
    const base64 = fileBuffer.toString('base64');
    const extension = storagePath.split('.').pop()?.toLowerCase() || 'png';
    const mimeType = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : `image/${extension}`;
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error("[Video Generation] Error reading image file:", error);
    throw new Error(`Failed to read image file: ${storagePath}`);
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    console.log("[Video Generation] Starting video generation request");
    const startTime = Date.now();

    const userId = await getCurrentUserId();
    if (!userId) {
      console.log("[Video Generation] Unauthorized - no user ID");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sceneId } = await params;
    console.log("[Video Generation] Scene ID:", sceneId);

    if (!isVolcVideoConfigured()) {
      console.log("[Video Generation] Volc video not configured");
      return NextResponse.json(
        { error: "Video generation service is not configured. Please set VOLC_API_KEY." },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { projectId } = body;

    if (!projectId || typeof projectId !== "string") {
      console.log("[Video Generation] Missing project ID");
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    console.log("[Video Generation] Project ID:", projectId);
    await getProjectById(projectId, userId);
    const scene = await getSceneById(sceneId);

    if (scene.project_id !== projectId) {
      console.log("[Video Generation] Scene does not belong to project");
      return NextResponse.json(
        { error: "Scene does not belong to this project" },
        { status: 400 }
      );
    }

    if (scene.image_status !== "completed") {
      console.log("[Video Generation] Image not completed, status:", scene.image_status);
      return NextResponse.json(
        { error: "Scene image must be completed before generating video" },
        { status: 400 }
      );
    }

    const latestImage = await getLatestImageBySceneId(sceneId);

    if (!latestImage) {
      console.log("[Video Generation] No image found for scene");
      return NextResponse.json(
        { error: "No image found for this scene. Please generate an image first." },
        { status: 400 }
      );
    }

    console.log("[Video Generation] Reading image from local storage:", latestImage.storage_path);
    console.log("[Video Generation] Scene description:", scene.description?.substring(0, 100) + "...");

    const imageBase64 = await getImageAsBase64(latestImage.storage_path);
    console.log("[Video Generation] Image converted to base64, length:", imageBase64.length);

    await updateSceneVideoStatus(sceneId, "processing");

    try {
      console.log("[Video Generation] Creating video task with Volcano Engine API");
      const taskStartTime = Date.now();

      const task = await createVideoTask(
        imageBase64,
        scene.description,
        {
          duration: 5,
          watermark: false,
        }
      );

      const taskDuration = Date.now() - taskStartTime;
      console.log("[Video Generation] Task created successfully:", task.taskId, "in", taskDuration, "ms");

      const video = await createProcessingVideo(sceneId, task.taskId);
      console.log("[Video Generation] Video record created:", video.id);

      const totalDuration = Date.now() - startTime;
      console.log("[Video Generation] Total request duration:", totalDuration, "ms");

      return NextResponse.json({
        success: true,
        taskId: task.taskId,
        videoId: video.id,
        sceneId,
        status: task.status,
        message: "Video task created successfully",
      });
    } catch (generationError) {
      console.error("[Video Generation] Error creating task:", generationError);
      await updateSceneVideoStatus(sceneId, "failed");
      throw generationError;
    }
  } catch (error) {
    console.error("[Video Generation] Error:", error);

    if (error instanceof VolcVideoApiError) {
      console.error("[Video Generation] Volc API Error:", {
        message: error.message,
        statusCode: error.statusCode,
        errorCode: error.errorCode
      });
      return NextResponse.json(
        { error: `Video generation error: ${error.message}`, details: error.message },
        { status: 502 }
      );
    }

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Video Generation] Unexpected error:", errorMessage);

    return NextResponse.json(
      { error: `Failed to create video task: ${errorMessage}` },
      { status: 500 }
    );
  }
}
