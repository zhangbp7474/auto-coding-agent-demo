import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import { updateSceneImageStatus } from "@/lib/db/scenes";
import { createImage, deleteImagesBySceneId } from "@/lib/db/media";
import {
  generateImageBuffer,
  isVolcImageConfigured,
  VolcImageApiError,
} from "@/lib/ai/volc-image";

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
    const { prompt, style, projectId, sceneId } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const imageBuffer = await generateImageBuffer(prompt, style, { size: "2K" });

    if (sceneId && projectId) {
      await updateSceneImageStatus(sceneId, "completed");
      const image = await createImage(sceneId, userId, projectId, imageBuffer, {
        width: 1024,
        height: 1024,
      });
      return NextResponse.json({ success: true, image }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      message: "Image generated successfully",
      size: imageBuffer.length,
    }, { status: 200 });
  } catch (error) {
    console.error("Error generating image:", error);

    if (error instanceof VolcImageApiError) {
      return NextResponse.json(
        { error: `Image generation error: ${error.message}` },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}
