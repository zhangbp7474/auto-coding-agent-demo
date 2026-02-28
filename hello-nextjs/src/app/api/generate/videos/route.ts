import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import {
  getScenesByProjectId,
  updateSceneVideoStatus,
} from "@/lib/db/scenes";
import { getProjectById, updateProjectStage } from "@/lib/db/projects";
import { getLatestImageBySceneId, createProcessingVideo, getSignedUrl } from "@/lib/db/media";
import {
  createVideoTask,
  isVolcVideoConfigured,
  VolcVideoApiError,
} from "@/lib/ai/volc-video";

interface VideoTaskResult {
  sceneId: string;
  orderIndex: number;
  success: boolean;
  taskId?: string;
  videoId?: string;
  error?: string;
}

async function createSceneVideoTask(
  sceneId: string,
  orderIndex: number,
  description: string,
  imageUrl: string
): Promise<VideoTaskResult> {
  try {
    const task = await createVideoTask(imageUrl, description, {
      duration: 5,
      watermark: false,
    });

    await updateSceneVideoStatus(sceneId, "processing");

    const video = await createProcessingVideo(sceneId, task.taskId);

    return {
      sceneId,
      orderIndex,
      success: true,
      taskId: task.taskId,
      videoId: video.id,
    };
  } catch (error) {
    await updateSceneVideoStatus(sceneId, "failed");

    return {
      sceneId,
      orderIndex,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isVolcVideoConfigured()) {
      return NextResponse.json(
        { error: "Video generation service is not configured. Please set VOLC_API_KEY." },
        { status: 503 }
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
    const scenes = await getScenesByProjectId(projectId);

    const scenesToGenerate = scenes.filter(
      (scene) =>
        scene.image_status === "completed" &&
        (scene.video_status === "pending" || scene.video_status === "failed")
    );

    if (scenesToGenerate.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No scenes require video generation.",
        results: [],
        created: 0,
        failed: 0,
      });
    }

    if (project.stage === "images") {
      await updateProjectStage(projectId, userId, "videos");
    }

    const results: VideoTaskResult[] = [];

    for (const scene of scenesToGenerate) {
      const latestImage = await getLatestImageBySceneId(scene.id);

      if (!latestImage) {
        results.push({
          sceneId: scene.id,
          orderIndex: scene.order_index,
          success: false,
          error: "No image found for scene",
        });
        continue;
      }

      const imageUrl = await getSignedUrl(latestImage.storage_path, 3600);

      const result = await createSceneVideoTask(
        scene.id,
        scene.order_index,
        scene.description,
        imageUrl
      );
      results.push(result);
    }

    const created = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Created video tasks for ${created} scenes. ${failed} failed.`,
      results,
      created,
      failed,
      total: scenesToGenerate.length,
    });
  } catch (error) {
    console.error("Error creating video tasks:", error);

    if (error instanceof VolcVideoApiError) {
      return NextResponse.json(
        { error: `Video generation error: ${error.message}` },
        { status: 502 }
      );
    }

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to create video tasks" },
      { status: 500 }
    );
  }
}
