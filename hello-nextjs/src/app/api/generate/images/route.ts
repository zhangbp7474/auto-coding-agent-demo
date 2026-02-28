import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import { getScenesByProjectId, updateSceneImageStatus } from "@/lib/db/scenes";
import { getProjectById, updateProjectStage } from "@/lib/db/projects";
import { createImage, deleteImagesBySceneId } from "@/lib/db/media";
import {
  generateImageBuffer,
  isVolcImageConfigured,
  VolcImageApiError,
} from "@/lib/ai/volc-image";
import type { Image } from "@/types/database";

interface GenerationResult {
  sceneId: string;
  orderIndex: number;
  success: boolean;
  image?: Image;
  error?: string;
}

async function generateSceneImage(
  userId: string,
  projectId: string,
  sceneId: string,
  orderIndex: number,
  description: string,
  style?: string
): Promise<GenerationResult> {
  try {
    await updateSceneImageStatus(sceneId, "processing");

    const imageBuffer = await generateImageBuffer(description, style, { size: "2K" });

    await deleteImagesBySceneId(sceneId);

    const image = await createImage(sceneId, userId, projectId, imageBuffer, {
      width: 1024,
      height: 1024,
    });

    await updateSceneImageStatus(sceneId, "completed");

    return {
      sceneId,
      orderIndex,
      success: true,
      image,
    };
  } catch (error) {
    await updateSceneImageStatus(sceneId, "failed");

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

    if (!isVolcImageConfigured()) {
      return NextResponse.json(
        { error: "Image generation service is not configured. Please set VOLC_API_KEY." },
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
        scene.description_confirmed &&
        (scene.image_status === "pending" || scene.image_status === "failed")
    );

    if (scenesToGenerate.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No scenes require image generation.",
        results: [],
        completed: 0,
        failed: 0,
      });
    }

    if (project.stage === "scenes") {
      await updateProjectStage(projectId, userId, "images");
    }

    const results: GenerationResult[] = [];

    for (const scene of scenesToGenerate) {
      const result = await generateSceneImage(
        userId,
        projectId,
        scene.id,
        scene.order_index,
        scene.description,
        project.style ?? undefined
      );
      results.push(result);
    }

    const completed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Generated images for ${completed} scenes. ${failed} failed.`,
      results,
      completed,
      failed,
      total: scenesToGenerate.length,
    });
  } catch (error) {
    console.error("Error generating images:", error);

    if (error instanceof VolcImageApiError) {
      return NextResponse.json(
        { error: `Image generation error: ${error.message}` },
        { status: 502 }
      );
    }

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to generate images" },
      { status: 500 }
    );
  }
}
