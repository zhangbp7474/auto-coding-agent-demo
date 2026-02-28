import { query } from "./client";
import type { Project } from "@/types/database";

export interface ProjectWithPreview extends Project {
  preview_image_url: string | null;
  scene_count: number;
}

export async function getProjectsWithPreview(
  userId: string,
  options: {
    page?: number;
    limit?: number;
  } = {}
): Promise<{ projects: ProjectWithPreview[]; total: number }> {
  const page = options.page ?? 1;
  const limit = options.limit ?? 20;
  const offset = (page - 1) * limit;

  const countResult = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM projects WHERE user_id = ?`,
    [userId]
  );
  const total = countResult.rows[0]?.count ?? 0;

  const projectsResult = await query<Project>(
    `SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  const projects = projectsResult.rows;

  if (projects.length === 0) {
    return {
      projects: [],
      total,
    };
  }

  const projectIds = projects.map((p) => p.id);

  const placeholders = projectIds.map(() => "?").join(",");
  
  const sceneCountsResult = await query<{
    project_id: string;
    count: number;
  }>(
    `SELECT project_id, COUNT(*) as count FROM scenes WHERE project_id IN (${placeholders}) GROUP BY project_id`,
    projectIds
  );

  const sceneCountMap = new Map<string, number>();
  sceneCountsResult.rows.forEach((row) => {
    sceneCountMap.set(row.project_id, row.count);
  });

  const firstScenesResult = await query<{
    id: string;
    project_id: string;
  }>(
    `SELECT id, project_id FROM scenes WHERE project_id IN (${placeholders}) GROUP BY project_id ORDER BY order_index ASC`,
    projectIds
  );

  const firstSceneMap = new Map<string, string>();
  firstScenesResult.rows.forEach((scene) => {
    if (!firstSceneMap.has(scene.project_id)) {
      firstSceneMap.set(scene.project_id, scene.id);
    }
  });

  const firstSceneIds = Array.from(firstSceneMap.values());

  const previewImageMap = new Map<string, string>();
  if (firstSceneIds.length > 0) {
    const scenePlaceholders = firstSceneIds.map(() => "?").join(",");
    const previewImagesResult = await query<{
      scene_id: string;
      url: string;
    }>(
      `SELECT scene_id, url FROM images WHERE scene_id IN (${scenePlaceholders}) GROUP BY scene_id ORDER BY version DESC`,
      firstSceneIds
    );

    previewImagesResult.rows.forEach((row) => {
      if (!previewImageMap.has(row.scene_id)) {
        previewImageMap.set(row.scene_id, row.url);
      }
    });
  }

  const projectsWithPreview: ProjectWithPreview[] = projects.map((project) => {
    const firstSceneId = firstSceneMap.get(project.id);
    const previewImageUrl = firstSceneId
      ? previewImageMap.get(firstSceneId) ?? null
      : null;

    return {
      ...project,
      preview_image_url: previewImageUrl,
      scene_count: sceneCountMap.get(project.id) ?? 0,
    };
  });

  return {
    projects: projectsWithPreview,
    total,
  };
}
