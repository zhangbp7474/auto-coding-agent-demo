import { query, generateId } from "./client";
import type { Scene, SceneWithMedia, Image, Video } from "@/types/database";

export class SceneError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "unauthorized" | "database_error"
  ) {
    super(message);
    this.name = "SceneError";
  }
}

export async function createScene(data: {
  projectId: string;
  orderIndex: number;
  description: string;
}): Promise<Scene> {
  const id = generateId();
  await query(
    `INSERT INTO scenes (id, project_id, order_index, description, description_confirmed, image_status, image_confirmed, video_status, video_confirmed) VALUES (?, ?, ?, ?, 0, 'pending', 0, 'pending', 0)`,
    [id, data.projectId, data.orderIndex, data.description]
  );

  const result = await query<Scene>(
    `SELECT * FROM scenes WHERE id = ?`,
    [id]
  );

  if (!result.rows[0]) {
    throw new SceneError("Failed to create scene", "database_error");
  }

  return result.rows[0];
}

export async function createScenes(
  projectId: string,
  scenes: Array<{
    order_index: number;
    description: string;
  }>
): Promise<Scene[]> {
  if (scenes.length === 0) return [];

  const createdScenes: Scene[] = [];
  
  for (const scene of scenes) {
    const created = await createScene({
      projectId,
      orderIndex: scene.order_index,
      description: scene.description,
    });
    createdScenes.push(created);
  }

  return createdScenes;
}

export async function getScenesByProjectId(projectId: string): Promise<Scene[]> {
  const result = await query<Scene>(
    `SELECT * FROM scenes WHERE project_id = ? ORDER BY order_index ASC`,
    [projectId]
  );
  return result.rows;
}

export async function getScenesWithMediaByProjectId(
  projectId: string
): Promise<SceneWithMedia[]> {
  const scenesResult = await query<Scene>(
    `SELECT * FROM scenes WHERE project_id = ? ORDER BY order_index ASC`,
    [projectId]
  );

  if (scenesResult.rows.length === 0) {
    return [];
  }

  const sceneIds = scenesResult.rows.map((s) => s.id);

  const placeholders = sceneIds.map(() => "?").join(",");
  const imagesResult = await query<Image>(
    `SELECT * FROM images WHERE scene_id IN (${placeholders})`,
    sceneIds
  );
  const videosResult = await query<Video>(
    `SELECT * FROM videos WHERE scene_id IN (${placeholders})`,
    sceneIds
  );

  return scenesResult.rows.map((scene) => ({
    ...scene,
    description_confirmed: Boolean((scene as unknown as { description_confirmed: number }).description_confirmed),
    image_confirmed: Boolean((scene as unknown as { image_confirmed: number }).image_confirmed),
    video_confirmed: Boolean((scene as unknown as { video_confirmed: number }).video_confirmed),
    images: imagesResult.rows.filter((img) => img.scene_id === scene.id),
    videos: videosResult.rows.filter((vid) => vid.scene_id === scene.id),
  }));
}

export async function getSceneById(sceneId: string): Promise<Scene> {
  const result = await query<Scene>(
    `SELECT * FROM scenes WHERE id = ?`,
    [sceneId]
  );

  if (result.rows.length === 0) {
    throw new SceneError("Scene not found", "not_found");
  }

  return result.rows[0];
}

export async function updateSceneDescription(
  sceneId: string,
  description: string
): Promise<Scene> {
  await query(
    `UPDATE scenes SET description = ? WHERE id = ?`,
    [description, sceneId]
  );

  const result = await query<Scene>(
    `SELECT * FROM scenes WHERE id = ?`,
    [sceneId]
  );

  if (result.rows.length === 0) {
    throw new SceneError("Scene not found", "not_found");
  }

  return result.rows[0];
}

export async function confirmSceneDescription(sceneId: string): Promise<Scene> {
  await query(
    `UPDATE scenes SET description_confirmed = 1 WHERE id = ?`,
    [sceneId]
  );

  const result = await query<Scene>(
    `SELECT * FROM scenes WHERE id = ?`,
    [sceneId]
  );

  if (result.rows.length === 0) {
    throw new SceneError("Scene not found", "not_found");
  }

  return result.rows[0];
}

export async function confirmAllDescriptions(projectId: string): Promise<number> {
  const result = await query(
    `UPDATE scenes SET description_confirmed = 1 WHERE project_id = ?`,
    [projectId]
  );

  await query(
    `UPDATE projects SET stage = 'images', updated_at = datetime('now') WHERE id = ?`,
    [projectId]
  );

  return result.rowCount ?? 0;
}

export async function updateSceneImageStatus(
  sceneId: string,
  status: "pending" | "processing" | "completed" | "failed"
): Promise<Scene> {
  await query(
    `UPDATE scenes SET image_status = ? WHERE id = ?`,
    [status, sceneId]
  );

  const result = await query<Scene>(
    `SELECT * FROM scenes WHERE id = ?`,
    [sceneId]
  );

  if (result.rows.length === 0) {
    throw new SceneError("Scene not found", "not_found");
  }

  return result.rows[0];
}

export async function confirmSceneImage(sceneId: string): Promise<Scene> {
  await query(
    `UPDATE scenes SET image_confirmed = 1 WHERE id = ?`,
    [sceneId]
  );

  const result = await query<Scene>(
    `SELECT * FROM scenes WHERE id = ?`,
    [sceneId]
  );

  if (result.rows.length === 0) {
    throw new SceneError("Scene not found", "not_found");
  }

  return result.rows[0];
}

export async function confirmAllImages(projectId: string): Promise<number> {
  const result = await query(
    `UPDATE scenes SET image_confirmed = 1 WHERE project_id = ? AND image_status = 'completed'`,
    [projectId]
  );

  await query(
    `UPDATE projects SET stage = 'videos', updated_at = datetime('now') WHERE id = ?`,
    [projectId]
  );

  return result.rowCount ?? 0;
}

export async function updateSceneVideoStatus(
  sceneId: string,
  status: "pending" | "processing" | "completed" | "failed"
): Promise<Scene> {
  await query(
    `UPDATE scenes SET video_status = ? WHERE id = ?`,
    [status, sceneId]
  );

  const result = await query<Scene>(
    `SELECT * FROM scenes WHERE id = ?`,
    [sceneId]
  );

  if (result.rows.length === 0) {
    throw new SceneError("Scene not found", "not_found");
  }

  return result.rows[0];
}

export async function confirmSceneVideo(sceneId: string): Promise<Scene> {
  await query(
    `UPDATE scenes SET video_confirmed = 1 WHERE id = ?`,
    [sceneId]
  );

  const result = await query<Scene>(
    `SELECT * FROM scenes WHERE id = ?`,
    [sceneId]
  );

  if (result.rows.length === 0) {
    throw new SceneError("Scene not found", "not_found");
  }

  return result.rows[0];
}

export async function confirmAllVideos(projectId: string): Promise<number> {
  const result = await query(
    `UPDATE scenes SET video_confirmed = 1 WHERE project_id = ? AND video_status = 'completed'`,
    [projectId]
  );

  await query(
    `UPDATE projects SET stage = 'completed', updated_at = datetime('now') WHERE id = ?`,
    [projectId]
  );

  return result.rowCount ?? 0;
}

export async function deleteScenesByProjectId(projectId: string): Promise<number> {
  const countResult = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM scenes WHERE project_id = ?`,
    [projectId]
  );

  const count = countResult.rows[0]?.count ?? 0;

  await query(`DELETE FROM scenes WHERE project_id = ?`, [projectId]);

  return count;
}

export async function resetSceneImageStatus(sceneId: string): Promise<Scene> {
  await query(
    `UPDATE scenes SET image_status = 'pending', image_confirmed = 0 WHERE id = ?`,
    [sceneId]
  );

  const result = await query<Scene>(
    `SELECT * FROM scenes WHERE id = ?`,
    [sceneId]
  );

  if (result.rows.length === 0) {
    throw new SceneError("Scene not found", "not_found");
  }

  return result.rows[0];
}

export async function resetSceneVideoStatus(sceneId: string): Promise<Scene> {
  await query(
    `UPDATE scenes SET video_status = 'pending', video_confirmed = 0 WHERE id = ?`,
    [sceneId]
  );

  const result = await query<Scene>(
    `SELECT * FROM scenes WHERE id = ?`,
    [sceneId]
  );

  if (result.rows.length === 0) {
    throw new SceneError("Scene not found", "not_found");
  }

  return result.rows[0];
}

export async function getConfirmedDescriptionCount(projectId: string): Promise<number> {
  const result = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM scenes WHERE project_id = ? AND description_confirmed = 1`,
    [projectId]
  );
  return result.rows[0]?.count ?? 0;
}

export async function getCompletedImageCount(projectId: string): Promise<number> {
  const result = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM scenes WHERE project_id = ? AND image_status = 'completed'`,
    [projectId]
  );
  return result.rows[0]?.count ?? 0;
}

export async function getCompletedVideoCount(projectId: string): Promise<number> {
  const result = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM scenes WHERE project_id = ? AND video_status = 'completed'`,
    [projectId]
  );
  return result.rows[0]?.count ?? 0;
}
