import { query, generateId } from "./client";
import { saveFile, generateFilename } from "../storage/local";
import { getAppConfig } from "../config";
import type { Image, Video } from "@/types/database";

export class MediaError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "unauthorized" | "storage_error" | "database_error"
  ) {
    super(message);
    this.name = "MediaError";
  }
}

export async function createImage(
  sceneId: string,
  userId: string,
  projectId: string,
  imageData: Buffer,
  options: {
    width?: number;
    height?: number;
  } = {}
): Promise<Image> {
  const fileName = generateFilename("image.png");
  const { path: storagePath, url } = await saveFile(
    userId,
    projectId,
    `images/${sceneId}/${fileName}`,
    imageData
  );

  const id = generateId();
  
  await query(
    `INSERT INTO images (id, scene_id, storage_path, url, width, height, version) VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [id, sceneId, storagePath, url, options.width ?? null, options.height ?? null]
  );

  const result = await query<Image>(
    `SELECT * FROM images WHERE id = ?`,
    [id]
  );

  return result.rows[0];
}

export async function getImagesBySceneId(sceneId: string): Promise<Image[]> {
  const result = await query<Image>(
    `SELECT * FROM images WHERE scene_id = ? ORDER BY version DESC`,
    [sceneId]
  );
  return result.rows;
}

export async function getLatestImageBySceneId(sceneId: string): Promise<Image | null> {
  const result = await query<Image>(
    `SELECT * FROM images WHERE scene_id = ? ORDER BY version DESC LIMIT 1`,
    [sceneId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

export async function getImageById(imageId: string): Promise<Image> {
  const result = await query<Image>(
    `SELECT * FROM images WHERE id = ?`,
    [imageId]
  );

  if (result.rows.length === 0) {
    throw new MediaError("Image not found", "not_found");
  }

  return result.rows[0];
}

export async function deleteImagesBySceneId(sceneId: string): Promise<number> {
  const countResult = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM images WHERE scene_id = ?`,
    [sceneId]
  );

  const count = countResult.rows[0]?.count ?? 0;

  await query(`DELETE FROM images WHERE scene_id = ?`, [sceneId]);

  return count;
}

export async function createVideo(
  sceneId: string,
  userId: string,
  projectId: string,
  videoData: Buffer,
  options: {
    duration?: number;
    taskId?: string;
  } = {}
): Promise<Video> {
  const fileName = generateFilename("video.mp4");
  const { path: storagePath, url } = await saveFile(
    userId,
    projectId,
    `videos/${sceneId}/${fileName}`,
    videoData
  );

  const id = generateId();
  
  await query(
    `INSERT INTO videos (id, scene_id, storage_path, url, duration, task_id, version) VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [id, sceneId, storagePath, url, options.duration ?? null, options.taskId ?? null]
  );

  const result = await query<Video>(
    `SELECT * FROM videos WHERE id = ?`,
    [id]
  );

  return result.rows[0];
}

export async function createProcessingVideo(
  sceneId: string,
  taskId: string
): Promise<Video> {
  const id = generateId();
  
  await query(
    `INSERT INTO videos (id, scene_id, storage_path, url, duration, task_id, version) VALUES (?, ?, '', '', NULL, ?, 1)`,
    [id, sceneId, taskId]
  );

  const result = await query<Video>(
    `SELECT * FROM videos WHERE id = ?`,
    [id]
  );

  return result.rows[0];
}

export async function updateVideoTaskId(
  videoId: string,
  taskId: string
): Promise<Video> {
  await query(
    `UPDATE videos SET task_id = ? WHERE id = ?`,
    [taskId, videoId]
  );

  const result = await query<Video>(
    `SELECT * FROM videos WHERE id = ?`,
    [videoId]
  );

  if (result.rows.length === 0) {
    throw new MediaError("Video not found", "not_found");
  }

  return result.rows[0];
}

export async function updateCompletedVideo(
  videoId: string,
  storagePath: string,
  url: string,
  options: {
    duration?: number;
  } = {}
): Promise<Video> {
  await query(
    `UPDATE videos SET storage_path = ?, url = ?, duration = ? WHERE id = ?`,
    [storagePath, url, options.duration ?? null, videoId]
  );

  const result = await query<Video>(
    `SELECT * FROM videos WHERE id = ?`,
    [videoId]
  );

  if (result.rows.length === 0) {
    throw new MediaError("Video not found", "not_found");
  }

  return result.rows[0];
}

export async function getVideosBySceneId(sceneId: string): Promise<Video[]> {
  const result = await query<Video>(
    `SELECT * FROM videos WHERE scene_id = ? ORDER BY version DESC`,
    [sceneId]
  );
  return result.rows;
}

export async function getLatestVideoBySceneId(sceneId: string): Promise<Video | null> {
  const result = await query<Video>(
    `SELECT * FROM videos WHERE scene_id = ? ORDER BY version DESC LIMIT 1`,
    [sceneId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

export async function getVideoById(videoId: string): Promise<Video> {
  const result = await query<Video>(
    `SELECT * FROM videos WHERE id = ?`,
    [videoId]
  );

  if (result.rows.length === 0) {
    throw new MediaError("Video not found", "not_found");
  }

  return result.rows[0];
}

export async function deleteVideosBySceneId(sceneId: string): Promise<number> {
  const countResult = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM videos WHERE scene_id = ?`,
    [sceneId]
  );

  const count = countResult.rows[0]?.count ?? 0;

  await query(`DELETE FROM videos WHERE scene_id = ?`, [sceneId]);

  return count;
}

export async function getMediaBySceneId(sceneId: string): Promise<{
  images: Image[];
  videos: Video[];
}> {
  const [images, videos] = await Promise.all([
    getImagesBySceneId(sceneId),
    getVideosBySceneId(sceneId),
  ]);

  return { images, videos };
}

export async function uploadFile(
  userId: string,
  projectId: string,
  fileName: string,
  data: Buffer,
  options: { contentType?: string } = {}
): Promise<{ path: string; url: string }> {
  return saveFile(userId, projectId, fileName, data);
}

export async function getSignedUrl(storagePath: string, expiresIn: number = 3600): Promise<string> {
  const config = getAppConfig();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/api/files/${storagePath}`;
}
