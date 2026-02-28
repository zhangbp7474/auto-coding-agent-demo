import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import { updateSceneDescription } from "@/lib/db/scenes";
import { getSceneById } from "@/lib/db/scenes";
import { getProjectById } from "@/lib/db/projects";

interface Params {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { description } = body;

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    const scene = await getSceneById(id);
    const project = await getProjectById(scene.project_id, userId);

    if (project.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatedScene = await updateSceneDescription(id, description);

    return NextResponse.json({ scene: updatedScene });
  } catch (error) {
    console.error("Update scene error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
