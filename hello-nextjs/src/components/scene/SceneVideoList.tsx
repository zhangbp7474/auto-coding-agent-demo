"use client";

import { useState, useMemo, useEffect } from "react";
import { SceneVideoCard } from "./SceneVideoCard";
import { useSignedUrls } from "@/hooks/useSignedUrls";
import type { Scene, Image as ImageType, Video } from "@/types/database";

type SceneWithMedia = Scene & { images: ImageType[]; videos: Video[] };

interface SceneVideoListProps {
  projectId: string;
  scenes: SceneWithMedia[];
}

interface ApiError {
  error: string;
  details?: string;
}

function getUserFriendlyVideoError(error: string | undefined, status: number): string {
  if (!error) return "视频生成失败，请稍后重试";

  if (error.includes("resource download failed")) {
    return "图片无法访问，请确保服务器可通过公网访问后再试";
  }
  if (error.includes("image_url")) {
    return "图片格式错误，请重新生成图片";
  }
  if (error.includes("not configured")) {
    return "视频生成服务未配置，请联系管理员";
  }
  if (error.includes("not found")) {
    return "找不到指定的图片或场景";
  }

  return error;
}

/**
 * Scene video list component.
 * Displays all scenes with their videos and bulk actions.
 */
export function SceneVideoList({ projectId, scenes }: SceneVideoListProps) {
  const [localScenes, setLocalScenes] = useState(scenes);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [isConfirmingAll, setIsConfirmingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resume polling for any videos that are still processing when component mounts
  useEffect(() => {
    localScenes.forEach((scene) => {
      if (scene.video_status === "processing" && scene.videos.length > 0) {
        const latestVideo = scene.videos[scene.videos.length - 1];
        if (latestVideo.task_id) {
          pollForVideoCompletion(scene.id, latestVideo.task_id, latestVideo.id);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const storagePaths = useMemo(() => {
    const paths: string[] = [];
    localScenes.forEach((scene) => {
      if (scene.images[0]?.storage_path) {
        paths.push(scene.images[0].storage_path);
      }
      if (scene.videos[0]?.storage_path) {
        paths.push(scene.videos[0].storage_path);
      }
    });
    return paths;
  }, [localScenes]);

  const { urls: signedUrls } = useSignedUrls({ paths: storagePaths });

  const confirmedCount = localScenes.filter((s) => s.video_confirmed).length;
  const completedCount = localScenes.filter(
    (s) => s.video_status === "completed"
  ).length;
  const allConfirmed = confirmedCount === localScenes.length;
  const canConfirmAll = completedCount === localScenes.length && !allConfirmed;

  const handleGenerateVideo = async (sceneId: string) => {
    setError(null);

    const response = await fetch(`/api/generate/video/scene/${sceneId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ projectId }),
    });

    if (!response.ok) {
      let errorMessage = "Failed to generate video";
      try {
        const data: ApiError = await response.json();
        errorMessage = getUserFriendlyVideoError(data.error, response.status);
        console.error("Video generation error:", {
          status: response.status,
          error: data.error,
          details: data.details,
          friendlyMessage: errorMessage,
        });
      } catch {
        console.warn("Failed to parse error response");
      }
      setError(errorMessage);
      return;
    }

    const data = await response.json();
    const { taskId, videoId } = data;

    console.log("Video task created:", taskId);

    setLocalScenes((prev) =>
      prev.map((s) =>
        s.id === sceneId ? { ...s, video_status: "processing" } : s
      )
    );

    pollForVideoCompletion(sceneId, taskId, videoId);
  };

  const pollForVideoCompletion = async (
    sceneId: string,
    taskId: string,
    videoId: string
  ) => {
    const maxAttempts = 120; // 10 minutes max
    const interval = 5000; // 5 seconds

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, interval));

      try {
        // Call video task status API to check and download video
        const statusResponse = await fetch(
          `/api/generate/video/task/${taskId}?sceneId=${sceneId}&projectId=${projectId}&videoId=${videoId}`
        );

        if (!statusResponse.ok) continue;

        const statusData = await statusResponse.json();

        if (statusData.status === "completed") {
          // Fetch updated project data to get the video URL
          const projectResponse = await fetch(`/api/projects/${projectId}`);
          if (projectResponse.ok) {
            const { project } = await projectResponse.json();
            const scene = project.scenes.find(
              (s: SceneWithMedia) => s.id === sceneId
            );
            setLocalScenes((prev) =>
              prev.map((s) =>
                s.id === sceneId
                  ? { ...s, video_status: "completed", videos: scene?.videos ?? [] }
                  : s
              )
            );
          } else {
            // Still mark as completed even if we can't get the project data
            setLocalScenes((prev) =>
              prev.map((s) =>
                s.id === sceneId ? { ...s, video_status: "completed" } : s
              )
            );
          }
          return;
        }

        if (statusData.status === "failed") {
          setLocalScenes((prev) =>
            prev.map((s) =>
              s.id === sceneId ? { ...s, video_status: "failed" } : s
            )
          );
          return;
        }
      } catch (error) {
        console.error("Poll error:", error);
      }
    }
  };

  const handleConfirmVideo = async (sceneId: string) => {
    const response = await fetch(`/api/scenes/${sceneId}/confirm-video`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Failed to confirm video");
    }

    setLocalScenes((prev) =>
      prev.map((s) =>
        s.id === sceneId ? { ...s, video_confirmed: true } : s
      )
    );
  };

  const handleGenerateAll = async () => {
    setIsGeneratingAll(true);
    try {
      const response = await fetch("/api/generate/videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate videos");
      }

      const data = await response.json();
      const results = data.results || [];

      // Start polling for all scenes that had tasks created
      results.forEach((result: { sceneId: string; taskId?: string; videoId?: string; success: boolean }) => {
        if (result.success && result.taskId && result.videoId) {
          setLocalScenes((prev) =>
            prev.map((s) =>
              s.id === result.sceneId ? { ...s, video_status: "processing" } : s
            )
          );
          pollForVideoCompletion(result.sceneId, result.taskId, result.videoId);
        }
      });
    } catch (error) {
      console.error("Failed to generate all videos:", error);
    } finally {
      setIsGeneratingAll(false);
    }
  };

  const handleConfirmAll = async () => {
    setIsConfirmingAll(true);
    try {
      const response = await fetch("/api/scenes/confirm-all-videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        throw new Error("Failed to confirm all videos");
      }

      // Refresh the page to show the completed stage
      window.location.reload();
    } catch (error) {
      console.error("Failed to confirm all videos:", error);
      setIsConfirmingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
          </div>
          {error.includes("公网访问") && (
            <div className="mt-2 text-xs">
              <p>提示：视频生成需要公网可访问的图片URL。请使用 ngrok 或类似工具将本地服务暴露到公网。</p>
            </div>
          )}
          <button
            onClick={() => setError(null)}
            className="mt-2 text-xs underline hover:no-underline"
          >
            关闭
          </button>
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            已确认 {confirmedCount} / {localScenes.length} 个视频
          </span>
          {allConfirmed && (
            <span className="text-sm text-green-600 dark:text-green-400">
              ✓ 全部确认，项目完成！
            </span>
          )}
        </div>
      </div>

      {/* Generate All Button */}
      {!allConfirmed && (
        <div className="flex gap-3">
          <button
            onClick={handleGenerateAll}
            disabled={isGeneratingAll}
            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <svg
              className={`h-4 w-4 ${isGeneratingAll ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            {isGeneratingAll ? "生成中..." : "生成所有视频"}
          </button>
        </div>
      )}

      {/* Scene Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {localScenes.map((scene) => {
          const imageStoragePath = scene.images[0]?.storage_path;
          const videoStoragePath = scene.videos[0]?.storage_path;
          const signedImageUrl = imageStoragePath
            ? signedUrls[imageStoragePath]
            : undefined;
          const signedVideoUrl = videoStoragePath
            ? signedUrls[videoStoragePath]
            : undefined;

          return (
            <SceneVideoCard
              key={scene.id}
              scene={scene}
              signedImageUrl={signedImageUrl}
              signedVideoUrl={signedVideoUrl}
              onGenerate={handleGenerateVideo}
              onConfirm={handleConfirmVideo}
            />
          );
        })}
      </div>

      {/* Confirm All Button */}
      {canConfirmAll && (
        <div className="flex justify-end border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <button
            onClick={handleConfirmAll}
            disabled={isConfirmingAll}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isConfirmingAll ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                确认中...
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                确认所有视频
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
