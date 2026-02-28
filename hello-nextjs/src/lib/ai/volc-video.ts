import { getVolcEngineConfig } from "@/lib/config";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 60000;

export class VolcVideoApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorCode?: string
  ) {
    super(message);
    this.name = "VolcVideoApiError";
  }
}

export type VideoTaskStatus = "pending" | "processing" | "completed" | "failed";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isVolcVideoConfigured(): boolean {
  const config = getVolcEngineConfig();
  return !!config.api_key && config.api_key !== "YOUR_VOLC_API_KEY_HERE";
}

export interface VideoTaskResult {
  taskId: string;
  status: VideoTaskStatus;
}

export interface VideoStatusResult {
  taskId: string;
  status: VideoTaskStatus;
  progress?: number;
  videoUrl?: string;
  errorMessage?: string;
}

interface CreateTaskResponse {
  id: string;
  status?: string;
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

interface GetTaskResponse {
  id: string;
  status: string;
  content?: {
    video_url?: string;
  };
  output?: {
    url?: string;
    duration?: number;
  };
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

export async function createVideoTask(
  imageUrl: string,
  prompt?: string,
  options: {
    duration?: number;
    watermark?: boolean;
  } = {}
): Promise<VideoTaskResult> {
  if (!isVolcVideoConfigured()) {
    throw new VolcVideoApiError("Volcano Engine video generation is not configured. Please set VOLC_API_KEY.");
  }

  const config = getVolcEngineConfig();
  const duration = options.duration ?? config.video.default_duration;
  const watermark = options.watermark ?? config.video.watermark;
  const fullPrompt = `${prompt ?? ""} --duration ${duration} --camerafixed false --watermark ${watermark}`;

  const requestBody = {
    model: config.video.model,
    content: [
      {
        type: "text",
        text: fullPrompt,
      },
      {
        type: "image_url",
        image_url: {
          url: imageUrl,
        },
      },
    ],
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(config.video.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.api_key}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      const data: CreateTaskResponse = await response.json();

      if (data.error) {
        throw new VolcVideoApiError(
          data.error.message || `API error: ${data.error.code}`,
          response.status,
          data.error.code
        );
      }

      if (!response.ok) {
        throw new VolcVideoApiError(
          `HTTP error: ${response.status}`,
          response.status
        );
      }

      if (!data.id) {
        throw new VolcVideoApiError("No task ID in response");
      }

      clearTimeout(timeoutId);
      return {
        taskId: data.id,
        status: (data.status as VideoTaskStatus) || "pending",
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");

      if (error instanceof VolcVideoApiError && error.errorCode === "authentication_error") {
        throw error;
      }

      if ((error as Error).name === "AbortError") {
        throw new VolcVideoApiError("Request timed out");
      }

      if (attempt < MAX_RETRIES) {
        console.warn(`Volc Video API attempt ${attempt} failed, retrying...`, error);
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  clearTimeout(timeoutId);
  throw new VolcVideoApiError(
    `Failed after ${MAX_RETRIES} attempts: ${lastError?.message}`
  );
}

export async function getVideoTaskStatus(taskId: string): Promise<VideoStatusResult> {
  if (!isVolcVideoConfigured()) {
    throw new VolcVideoApiError("Volcano Engine video generation is not configured. Please set VOLC_API_KEY.");
  }

  const config = getVolcEngineConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${config.video.endpoint}/${taskId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.api_key}`,
        },
        signal: controller.signal,
      });

      const data: GetTaskResponse = await response.json();

      if (data.error) {
        return {
          taskId: data.id,
          status: "failed",
          errorMessage: data.error.message,
        };
      }

      if (!response.ok) {
        throw new VolcVideoApiError(
          `HTTP error: ${response.status}`,
          response.status
        );
      }

      clearTimeout(timeoutId);

      console.log(`Video task ${taskId} raw status:`, data.status);

      let status: VideoTaskStatus = "pending";
      if (data.status === "RUNNING" || data.status === "processing" || data.status === "running") {
        status = "processing";
      } else if (data.status === "SUCCESS" || data.status === "completed" || data.status === "succeeded") {
        status = "completed";
      } else if (data.status === "FAILED" || data.status === "failed") {
        status = "failed";
      }

      const videoUrl = data.content?.video_url || data.output?.url;

      return {
        taskId: data.id,
        status,
        videoUrl,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");

      if (error instanceof VolcVideoApiError && error.errorCode === "authentication_error") {
        throw error;
      }

      if ((error as Error).name === "AbortError") {
        throw new VolcVideoApiError("Request timed out");
      }

      if (attempt < MAX_RETRIES) {
        console.warn(`Volc Video Status API attempt ${attempt} failed, retrying...`, error);
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  clearTimeout(timeoutId);
  throw new VolcVideoApiError(
    `Failed after ${MAX_RETRIES} attempts: ${lastError?.message}`
  );
}

export async function waitForVideoTask(
  taskId: string,
  options: {
    pollIntervalMs?: number;
    maxWaitMs?: number;
    onProgress?: (status: string) => void;
  } = {}
): Promise<VideoStatusResult> {
  const pollInterval = options.pollIntervalMs ?? 5000;
  const maxWait = options.maxWaitMs ?? 600000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const status = await getVideoTaskStatus(taskId);

    if (options.onProgress) {
      options.onProgress(status.status);
    }

    if (status.status === "completed") {
      return status;
    }

    if (status.status === "failed") {
      throw new VolcVideoApiError(
        status.errorMessage || "Video generation failed"
      );
    }

    await sleep(pollInterval);
  }

  throw new VolcVideoApiError(
    `Video generation timed out after ${maxWait / 1000} seconds`
  );
}

export async function downloadVideo(videoUrl: string): Promise<Buffer> {
  const response = await fetch(videoUrl);

  if (!response.ok) {
    throw new VolcVideoApiError(`Failed to download video: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
