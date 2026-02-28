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

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM projects WHERE user_id = $1`,
    [userId]
  );
  const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

  const projectsResult = await query<Project>(
    `SELECT * FROM projects WHERE user_id = $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3`,
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

  const sceneCountsResult = await query<{
    project_id: string;
    count: string;
  }>(
    `SELECT project_id, COUNT(*) as count FROM scenes WHERE project_id = ANY($1) GROUP BY project_id`,
    [projectIds]
  );

  const sceneCountMap = new Map<string, number>();
  sceneCountsResult.rows.forEach((row) => {
    sceneCountMap.set(row.project_id, parseInt(row.count, 10));
  });

  const firstScenesResult = await query<{
    id: string;
    project_id: string;
  }>(
    `SELECT DISTINCT ON (project_id) id, project_id FROM scenes WHERE project_id = ANY($1) ORDER BY project_id, order_index ASC`,
    [projectIds]
  );

  const firstSceneMap = new Map<string, string>();
  firstScenesResult.rows.forEach((scene) => {
    firstSceneMap.set(scene.project_id, scene.id);
  });

  const firstSceneIds = Array.from(firstSceneMap.values());

  let previewImageMap = new Map<string, string>();
  if (firstSceneIds.length > 0) {
    const previewImagesResult = await query<{
      scene_id: string;
      url: string;
    }>(
      `SELECT DISTINCT ON (scene_id) scene_id, url FROM images WHERE scene_id = ANY($1) ORDER BY scene_id, version DESC`,
      [firstSceneIds]
    );

    previewImagesResult.rows.forEach((row) => {
      previewImageMap.set(row.scene_id, row.url);
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
