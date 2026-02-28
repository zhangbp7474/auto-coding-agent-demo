import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import {
  getProjectById,
  updateProject,
  deleteProject,
  ProjectError,
} from "@/lib/db/projects";
import type { project_stage } from "@/types/database";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const project = await getProjectById(id, userId);

    return NextResponse.json({ project });
  } catch (error) {
    if (error instanceof ProjectError) {
      if (error.code === "not_found") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      if (error.code === "unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, story, style, stage } = body;

    if (!title && story === undefined && style === undefined && !stage) {
      return NextResponse.json(
        { error: "At least one field is required" },
        { status: 400 }
      );
    }

    if (stage) {
      const validStages = ["draft", "scenes", "images", "videos", "completed"];
      if (!validStages.includes(stage)) {
        return NextResponse.json(
          { error: "Invalid stage value" },
          { status: 400 }
        );
      }
    }

    const project = await updateProject(id, userId, {
      title,
      story,
      style,
      stage: stage as project_stage | undefined,
    });

    return NextResponse.json({ project });
  } catch (error) {
    if (error instanceof ProjectError) {
      if (error.code === "not_found") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      if (error.code === "unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await deleteProject(id, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectError) {
      if (error.code === "not_found") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      if (error.code === "unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
