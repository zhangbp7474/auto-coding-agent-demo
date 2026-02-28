import { query, generateId } from "./client";
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
  const id = generateId();
  
  await query(
    `INSERT INTO projects (id, user_id, title, story, style, stage) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userId, title, story ?? null, style ?? "default", "draft"]
  );
  
  const result = await query<Project>(
    `SELECT * FROM projects WHERE id = ?`,
    [id]
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

  const countResult = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM projects WHERE user_id = ?`,
    [userId]
  );
  const total = countResult.rows[0]?.count ?? 0;

  const result = await query<Project>(
    `SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
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
    `SELECT * FROM projects WHERE id = ? AND user_id = ?`,
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
    description_confirmed: number;
    image_status: string;
    image_confirmed: number;
    video_status: string;
    video_confirmed: number;
    created_at: string;
  }>(
    `SELECT * FROM scenes WHERE project_id = ? ORDER BY order_index ASC`,
    [projectId]
  );

  const sceneIds = scenesResult.rows.map((s) => s.id);

  let imagesResult = { rows: [] as Image[] };
  let videosResult = { rows: [] as Video[] };
  
  if (sceneIds.length > 0) {
    const placeholders = sceneIds.map(() => "?").join(",");
    imagesResult = await query<Image>(
      `SELECT * FROM images WHERE scene_id IN (${placeholders})`,
      sceneIds
    );
    videosResult = await query<Video>(
      `SELECT * FROM videos WHERE scene_id IN (${placeholders})`,
      sceneIds
    );
  }

  const scenesWithMedia = scenesResult.rows.map((scene) => ({
    ...scene,
    description_confirmed: Boolean(scene.description_confirmed),
    image_confirmed: Boolean(scene.image_confirmed),
    video_confirmed: Boolean(scene.video_confirmed),
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
    `SELECT user_id FROM projects WHERE id = ?`,
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

  if (updates.title !== undefined) {
    fields.push("title = ?");
    values.push(updates.title);
  }
  if (updates.story !== undefined) {
    fields.push("story = ?");
    values.push(updates.story);
  }
  if (updates.style !== undefined) {
    fields.push("style = ?");
    values.push(updates.style);
  }
  if (updates.stage !== undefined) {
    fields.push("stage = ?");
    values.push(updates.stage);
  }

  if (fields.length === 0) {
    const result = await query<Project>(
      `SELECT * FROM projects WHERE id = ?`,
      [projectId]
    );
    return result.rows[0];
  }

  fields.push("updated_at = datetime('now')");
  values.push(projectId);
  
  await query(
    `UPDATE projects SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  const result = await query<Project>(
    `SELECT * FROM projects WHERE id = ?`,
    [projectId]
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
  const existingResult = await query<{ user_id: string }>(
    `SELECT user_id FROM projects WHERE id = ?`,
    [projectId]
  );

  if (existingResult.rows.length === 0) {
    throw new ProjectError("Project not found", "not_found");
  }

  if (existingResult.rows[0].user_id !== userId) {
    throw new ProjectError("Unauthorized to delete this project", "unauthorized");
  }

  await query(`DELETE FROM projects WHERE id = ?`, [projectId]);
}

export async function isProjectOwner(
  projectId: string,
  userId: string
): Promise<boolean> {
  const result = await query<{ user_id: string }>(
    `SELECT user_id FROM projects WHERE id = ?`,
    [projectId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  return result.rows[0].user_id === userId;
}
