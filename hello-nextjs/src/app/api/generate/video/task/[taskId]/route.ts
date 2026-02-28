import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import {
  getVideoTaskStatus,
  isVolcVideoConfigured,
  VolcVideoApiError,
  downloadVideo,
} from "@/lib/ai/volc-video";
import {
  updateCompletedVideo,
  uploadFile,
} from "@/lib/db/media";
import { updateSceneVideoStatus } from "@/lib/db/scenes";

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskId } = await params;

    if (!isVolcVideoConfigured()) {
      return NextResponse.json(
        { error: "Video generation service is not configured. Please set VOLC_API_KEY." },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sceneId = searchParams.get("sceneId");
    const projectId = searchParams.get("projectId");
    const videoId = searchParams.get("videoId");

    const status = await getVideoTaskStatus(taskId);

    if (status.status === "completed" && status.videoUrl && sceneId && projectId && videoId) {
      try {
        const videoBuffer = await downloadVideo(status.videoUrl);

        const timestamp = Date.now();
        const fileName = `video-${taskId}-${timestamp}.mp4`;
        const { path, url } = await uploadFile(
          userId,
          projectId,
          fileName,
          videoBuffer,
          { contentType: "video/mp4" }
        );

        await updateCompletedVideo(videoId, path, url, {
          duration: 5,
        });

        await updateSceneVideoStatus(sceneId, "completed");

        return NextResponse.json({
          success: true,
          status: "completed",
          videoUrl: url,
          videoId,
          message: "Video generated and saved successfully",
        });
      } catch (saveError) {
        console.error("Error saving video:", saveError);
        return NextResponse.json({
          success: true,
          status: "completed",
          videoUrl: status.videoUrl,
          warning: "Video generated but failed to save to storage",
        });
      }
    }

    if (status.status === "failed" && sceneId) {
      await updateSceneVideoStatus(sceneId, "failed");
    }

    return NextResponse.json({
      success: true,
      status: status.status,
      videoUrl: status.videoUrl,
      errorMessage: status.errorMessage,
    });
  } catch (error) {
    console.error("Error querying video task status:", error);

    if (error instanceof VolcVideoApiError) {
      return NextResponse.json(
        { error: `Video status query error: ${error.message}` },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "Failed to query video task status" },
      { status: 500 }
    );
  }
}
