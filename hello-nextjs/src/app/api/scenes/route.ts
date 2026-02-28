import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import { createScene, getScenesByProjectId } from "@/lib/db/scenes";
import { getProjectById } from "@/lib/db/projects";

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, sceneNumber, title, description, duration } = body;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    const project = await getProjectById(projectId, userId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const orderIndex = sceneNumber ?? (await getScenesByProjectId(projectId)).length;

    const scene = await createScene({
      projectId,
      orderIndex,
      description: description || title || "",
    });

    return NextResponse.json({ scene }, { status: 201 });
  } catch (error) {
    console.error("Error creating scene:", error);
    return NextResponse.json(
      { error: "Failed to create scene" },
      { status: 500 }
    );
  }
}
