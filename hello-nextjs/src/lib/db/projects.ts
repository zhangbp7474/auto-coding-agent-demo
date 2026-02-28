import { query } from "./client";
import type {
  Project,
  ProjectInsert,
  ProjectUpdate,
  ProjectWithScenes,
  project_stage,
  Image,
  Video,
} from "@/types/database";

export class ProjectError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "unauthorized" | "database_error"
  ) {
    super(message);
    this.name = "ProjectError";
  }
}

export async function createProject(
  userId: string,
  title: string,
  story?: string,
  style?: string
): Promise<Project> {
  const result = await query<Project>(
    `INSERT INTO projects (user_id, title, story, style, stage) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, title, story ?? null, style ?? "default", "draft"]
  );
  return result.rows[0];
}

export async function getProjects(
  userId: string,
  options: {
    page?: number;
    limit?: number;
  } = {}
): Promise<{ projects: Project[]; total: number }> {
  const page = options.page ?? 1;
  const limit = options.limit ?? 20;
  const offset = (page - 1) * limit;

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM projects WHERE user_id = $1`,
    [userId]
  );
  const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

  const result = await query<Project>(
    `SELECT * FROM projects WHERE user_id = $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return {
    projects: result.rows,
    total,
  };
}

export async function getProjectById(
  projectId: string,
  userId: string
): Promise<ProjectWithScenes> {
  const projectResult = await query<Project>(
    `SELECT * FROM projects WHERE id = $1 AND user_id = $2`,
    [projectId, userId]
  );

  if (projectResult.rows.length === 0) {
    throw new ProjectError("Project not found", "not_found");
  }

  const project = projectResult.rows[0];

  const scenesResult = await query<{
    id: string;
    project_id: string;
    order_index: number;
    description: string;
    description_confirmed: boolean;
    image_status: string;
    image_confirmed: boolean;
    video_status: string;
    video_confirmed: boolean;
    created_at: string;
  }>(
    `SELECT * FROM scenes WHERE project_id = $1 ORDER BY order_index ASC`,
    [projectId]
  );

  const sceneIds = scenesResult.rows.map((s) => s.id);

  const [imagesResult, videosResult] = await Promise.all([
    sceneIds.length > 0
      ? query<Image>(`SELECT * FROM images WHERE scene_id = ANY($1)`, [sceneIds])
      : { rows: [] },
    sceneIds.length > 0
      ? query<Video>(`SELECT * FROM videos WHERE scene_id = ANY($1)`, [sceneIds])
      : { rows: [] },
  ]);

  const scenesWithMedia = scenesResult.rows.map((scene) => ({
    ...scene,
    image_status: scene.image_status as "pending" | "processing" | "completed" | "failed",
    video_status: scene.video_status as "pending" | "processing" | "completed" | "failed",
    images: imagesResult.rows.filter((img) => img.scene_id === scene.id),
    videos: videosResult.rows.filter((vid) => vid.scene_id === scene.id),
  }));

  return {
    ...project,
    scenes: scenesWithMedia,
  };
}

export async function updateProject(
  projectId: string,
  userId: string,
  updates: {
    title?: string;
    story?: string;
    style?: string;
    stage?: project_stage;
  }
): Promise<Project> {
  const existingResult = await query<{ user_id: string }>(
    `SELECT user_id FROM projects WHERE id = $1`,
    [projectId]
  );

  if (existingResult.rows.length === 0) {
    throw new ProjectError("Project not found", "not_found");
  }

  if (existingResult.rows[0].user_id !== userId) {
    throw new ProjectError("Unauthorized to update this project", "unauthorized");
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.title !== undefined) {
    fields.push(`title = $${paramIndex++}`);
    values.push(updates.title);
  }
  if (updates.story !== undefined) {
    fields.push(`story = $${paramIndex++}`);
    values.push(updates.story);
  }
  if (updates.style !== undefined) {
    fields.push(`style = $${paramIndex++}`);
    values.push(updates.style);
  }
  if (updates.stage !== undefined) {
    fields.push(`stage = $${paramIndex++}`);
    values.push(updates.stage);
  }

  if (fields.length === 0) {
    const result = await query<Project>(
      `SELECT * FROM projects WHERE id = $1`,
      [projectId]
    );
    return result.rows[0];
  }

  values.push(projectId);
  const result = await query<Project>(
    `UPDATE projects SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return result.rows[0];
}

export async function updateProjectStage(
  projectId: string,
  userId: string,
  stage: project_stage
): Promise<Project> {
  return updateProject(projectId, userId, { stage });
}

export async function deleteProject(
  projectId: string,
  userId: string
): Promise<void> {
  const existingResult = query<{ user_id: string }>(
    `SELECT user_id FROM projects WHERE id = $1`,
    [projectId]
  );

  const existing = (await existingResult).rows[0];

  if (!existing) {
    throw new ProjectError("Project not found", "not_found");
  }

  if (existing.user_id !== userId) {
    throw new ProjectError("Unauthorized to delete this project", "unauthorized");
  }

  await query(`DELETE FROM projects WHERE id = $1`, [projectId]);
}

export async function isProjectOwner(
  projectId: string,
  userId: string
): Promise<boolean> {
  const result = await query<{ user_id: string }>(
    `SELECT user_id FROM projects WHERE id = $1`,
    [projectId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  return result.rows[0].user_id === userId;
}
