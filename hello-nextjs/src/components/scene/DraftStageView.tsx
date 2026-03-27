"use client";

import { useState } from "react";

interface DraftStageViewProps {
  projectId: string;
}

interface ApiError {
  error: string;
  details?: string;
}

/**
 * Draft stage view component.
 * Displays the "Generate Scenes" button and handles scene generation.
 */
export function DraftStageView({ projectId }: DraftStageViewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateScenes = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/generate/scenes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to generate scenes";
        let errorDetails = "";

        try {
          const data: ApiError = await response.json();
          errorMessage = data.error || errorMessage;
          if (data.details) {
            errorDetails = data.details;
          }
        } catch {
          console.warn("Failed to parse error response");
        }

        console.error("Error generating scenes:", {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
          details: errorDetails
        });

        throw new Error(errorMessage);
      }

      window.location.reload();
    } catch (err) {
      console.error("Error generating scenes:", err);
      setError(err instanceof Error ? err.message : "Failed to generate scenes");
      setIsGenerating(false);
    }
  };

  return (
    <div className="py-8 text-center">
      <p className="mb-4 text-zinc-600 dark:text-zinc-400">
        准备好了吗？点击下方按钮开始生成分镜描述
      </p>
      {error && (
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <button
        onClick={handleGenerateScenes}
        disabled={isGenerating}
        className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        <svg
          className={`h-5 w-5 ${isGenerating ? "animate-spin" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
        {isGenerating ? "生成中..." : "生成分镜"}
      </button>
    </div>
  );
}
