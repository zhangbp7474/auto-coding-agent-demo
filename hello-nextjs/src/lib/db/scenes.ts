import { query } from "./client";
import type { Scene, SceneInsert, SceneWithMedia, Image, Video } from "@/types/database";

export class SceneError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "unauthorized" | "database_error"
  ) {
    super(message);
    this.name = "SceneError";
  }
}

export async function createScenes(
  projectId: string,
  scenes: Array<{
    order_index: number;
    description: string;
  }>
): Promise<Scene[]> {
  if (scenes.length === 0) return [];

  const values = scenes
    .map((scene, i) => `($1, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6}, $${i * 6 + 7}, $${i * 6 + 8})`)
    .join(", ");

  const params: unknown[] = [projectId];
  scenes.forEach((scene) => {
    params.push(
      scene.order_index,
      scene.description,
      false,
      "pending",
      false,
      "pending",
      false
    );
  });

  const result = await query<Scene>(
    `INSERT INTO scenes (project_id, order_index, description, description_confirmed, image_status, image_confirmed, video_status, video_confirmed) VALUES ${values} RETURNING *`,
    params
  );

  return result.rows;
}

export async function getScenesByProjectId(projectId: string): Promise<Scene[]> {
  const result = await query<Scene>(
    `SELECT * FROM scenes WHERE project_id = $1 ORDER BY order_index ASC`,
    [projectId]
  );
  return result.rows;
}

export async function getScenesWithMediaByProjectId(
  projectId: string
): Promise<SceneWithMedia[]> {
  const scenesResult = await query<Scene>(
    `SELECT * FROM scenes WHERE project_id = $1 ORDER BY order_index ASC`,
    [projectId]
  );

  if (scenesResult.rows.length === 0) {
    return [];
  }

  const sceneIds = scenesResult.rows.map((s) => s.id);

  const [imagesResult, videosResult] = await Promise.all([
    query<Image>(`SELECT * FROM images WHERE scene_id = ANY($1)`, [sceneIds]),
    query<Video>(`SELECT * FROM videos WHERE scene_id = ANY($1)`, [sceneIds]),
  ]);

  return scenesResult.rows.map((scene) => ({
    ...scene,
    images: imagesResult.rows.filter((img) => img.scene_id === scene.id),
    videos: videosResult.rows.filter((vid) => vid.scene_id === scene.id),
  }));
}

export async function getSceneById(sceneId: string): Promise<Scene> {
  const result = await query<Scene>(
    `SELECT * FROM scenes WHERE id = $1`,
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
  const result = await query<Scene>(
    `UPDATE scenes SET description = $1 WHERE id = $2 RETURNING *`,
    [description, sceneId]
  );

  if (result.rows.length === 0) {
    throw new SceneError("Scene not found", "not_found");
  }

  return result.rows[0];
}

export async function confirmSceneDescription(sceneId: string): Promise<Scene> {
  const result = await query<Scene>(
    `UPDATE scenes SET description_confirmed = true WHERE id = $1 RETURNING *`,
    [sceneId]
  );

  if (result.rows.length === 0) {
    throw new SceneError("Scene not found", "not_found");
  }

  return result.rows[0];
}

export async function confirmAllDescriptions(projectId: string): Promise<number> {
  const result = await query(
    `UPDATE scenes SET description_confirmed = true WHERE project_id = $1`,
    [projectId]
  );

  await query(
    `UPDATE projects SET stage = 'images', updated_at = NOW() WHERE id = $1`,
    [projectId]
  );

  return result.rowCount ?? 0;
}

export async function updateSceneImageStatus(
  sceneId: string,
  status: "pending" | "processing" | "completed" | "failed"
): Promise<Scene> {
  const result = await query<Scene>(
    `UPDATE scenes SET image_status = $1 WHERE id = $2 RETURNING *`,
    [status, sceneId]
  );

  if (result.rows.length === 0) {
    throw new SceneError("Scene not found", "not_found");
  }

  return result.rows[0];
}

export async function confirmSceneImage(sceneId: string): Promise<Scene> {
  const result = await query<Scene>(
    `UPDATE scenes SET image_confirmed = true WHERE id = $1 RETURNING *`,
    [sceneId]
  );

  if (result.rows.length === 0) {
    throw new SceneError("Scene not found", "not_found");
  }

  return result.rows[0];
}

export async function confirmAllImages(projectId: string): Promise<number> {
  const result = await query(
    `UPDATE scenes SET image_confirmed = true WHERE project_id = $1 AND image_status = 'completed'`,
    [projectId]
  );

  await query(
    `UPDATE projects SET stage = 'videos', updated_at = NOW() WHERE id = $1`,
    [projectId]
  );

  return result.rowCount ?? 0;
}

export async function updateSceneVideoStatus(
  sceneId: string,
  status: "pending" | "processing" | "completed" | "failed"
): Promise<Scene> {
  const result = await query<Scene>(
    `UPDATE scenes SET video_status = $1 WHERE id = $2 RETURNING *`,
    [status, sceneId]
  );

  if (result.rows.length === 0) {
    throw new SceneError("Scene not found", "not_found");
  }

  return result.rows[0];
}

export async function confirmSceneVideo(sceneId: string): Promise<Scene> {
  const result = await query<Scene>(
    `UPDATE scenes SET video_confirmed = true WHERE id = $1 RETURNING *`,
    [sceneId]
  );

  if (result.rows.length === 0) {
    throw new SceneError("Scene not found", "not_found");
  }

  return result.rows[0];
}

export async function confirmAllVideos(projectId: string): Promise<number> {
  const result = await query(
    `UPDATE scenes SET video_confirmed = true WHERE project_id = $1 AND video_status = 'completed'`,
    [projectId]
  );

  await query(
    `UPDATE projects SET stage = 'completed', updated_at = NOW() WHERE id = $1`,
    [projectId]
  );

  return result.rowCount ?? 0;
}

export async function deleteScenesByProjectId(projectId: string): Promise<number> {
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM scenes WHERE project_id = $1`,
    [projectId]
  );

  const count = parseInt(countResult.rows[0]?.count ?? "0", 10);

  await query(`DELETE FROM scenes WHERE project_id = $1`, [projectId]);

  return count;
}

export async function resetSceneImageStatus(sceneId: string): Promise<Scene> {
  const result = await query<Scene>(
    `UPDATE scenes SET image_status = 'pending', image_confirmed = false WHERE id = $1 RETURNING *`,
    [sceneId]
  );

  if (result.rows.length === 0) {
    throw new SceneError("Scene not found", "not_found");
  }

  return result.rows[0];
}

export async function resetSceneVideoStatus(sceneId: string): Promise<Scene> {
  const result = await query<Scene>(
    `UPDATE scenes SET video_status = 'pending', video_confirmed = false WHERE id = $1 RETURNING *`,
    [sceneId]
  );

  if (result.rows.length === 0) {
    throw new SceneError("Scene not found", "not_found");
  }

  return result.rows[0];
}

export async function getConfirmedDescriptionCount(projectId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM scenes WHERE project_id = $1 AND description_confirmed = true`,
    [projectId]
  );
  return parseInt(result.rows[0]?.count ?? "0", 10);
}

export async function getCompletedImageCount(projectId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM scenes WHERE project_id = $1 AND image_status = 'completed'`,
    [projectId]
  );
  return parseInt(result.rows[0]?.count ?? "0", 10);
}

export async function getCompletedVideoCount(projectId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM scenes WHERE project_id = $1 AND video_status = 'completed'`,
    [projectId]
  );
  return parseInt(result.rows[0]?.count ?? "0", 10);
}
