import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import {
  getSceneById,
  confirmSceneVideo,
  SceneError,
} from "@/lib/db/scenes";
import { isProjectOwner } from "@/lib/db/projects";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const scene = await getSceneById(id);

    const isOwner = await isProjectOwner(scene.project_id, userId);
    if (!isOwner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (scene.video_status !== "completed") {
      return NextResponse.json(
        { error: "Video must be completed before confirming" },
        { status: 400 }
      );
    }

    const updatedScene = await confirmSceneVideo(id);

    return NextResponse.json({ scene: updatedScene });
  } catch (error) {
    if (error instanceof SceneError) {
      if (error.code === "not_found") {
        return NextResponse.json({ error: "Scene not found" }, { status: 404 });
      }
    }
    console.error("Error confirming scene video:", error);
    return NextResponse.json(
      { error: "Failed to confirm scene video" },
      { status: 500 }
    );
  }
}
