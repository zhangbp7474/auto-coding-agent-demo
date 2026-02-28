import { getVolcEngineConfig } from "@/lib/config";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 120000;

export class VolcImageApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorCode?: string
  ) {
    super(message);
    this.name = "VolcImageApiError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isVolcImageConfigured(): boolean {
  const config = getVolcEngineConfig();
  return !!config.api_key && config.api_key !== "YOUR_VOLC_API_KEY_HERE";
}

function buildStylePrompt(style?: string): string {
  const stylePrompts: Record<string, string> = {
    realistic: ", photorealistic, high quality, natural lighting, sharp details",
    anime: ", anime style, vibrant colors, clean lines, Japanese animation",
    cartoon: ", cartoon style, bright colors, playful, exaggerated features",
    cinematic: ", cinematic, dramatic lighting, film grain, professional cinematography",
    watercolor: ", watercolor painting style, soft edges, delicate colors, artistic",
    oil_painting: ", oil painting style, thick brushstrokes, rich colors, classical art",
    sketch: ", pencil sketch style, detailed linework, grayscale, artistic drawing",
    cyberpunk: ", cyberpunk style, neon lights, futuristic, dark atmosphere, tech aesthetic",
    fantasy: ", fantasy style, magical elements, ethereal, dreamlike, mystical",
    scifi: ", sci-fi style, futuristic, high-tech, space age, advanced technology",
  };

  return stylePrompts[style ?? "realistic"] || stylePrompts.realistic;
}

interface ImageGenerationResponse {
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
  }>;
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

export async function generateImage(
  prompt: string,
  style?: string,
  options: {
    size?: "1K" | "2K" | "720p" | "1080p";
  } = {}
): Promise<string> {
  if (!isVolcImageConfigured()) {
    throw new VolcImageApiError("Volcano Engine image generation is not configured. Please set VOLC_API_KEY.");
  }

  const config = getVolcEngineConfig();
  const stylePrompt = buildStylePrompt(style);
  const fullPrompt = `${prompt}${stylePrompt}`;

  const requestBody = {
    model: config.image.model,
    prompt: fullPrompt,
    size: options.size ?? config.image.default_size,
    watermark: config.image.watermark,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(config.image.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.api_key}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      const data: ImageGenerationResponse = await response.json();

      if (data.error) {
        throw new VolcImageApiError(
          data.error.message || `API error: ${data.error.code}`,
          response.status,
          data.error.code
        );
      }

      if (!response.ok) {
        throw new VolcImageApiError(
          `HTTP error: ${response.status}`,
          response.status
        );
      }

      const imageData = data.data?.[0];
      if (!imageData) {
        throw new VolcImageApiError("No image data in response");
      }

      if (imageData.url) {
        const imageResponse = await fetch(imageData.url);
        if (!imageResponse.ok) {
          throw new VolcImageApiError("Failed to download generated image");
        }
        const arrayBuffer = await imageResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        clearTimeout(timeoutId);
        return base64;
      }

      if (imageData.b64_json) {
        clearTimeout(timeoutId);
        return imageData.b64_json;
      }

      throw new VolcImageApiError("No image URL or base64 data in response");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");

      if (error instanceof VolcImageApiError && error.errorCode === "authentication_error") {
        throw error;
      }

      if ((error as Error).name === "AbortError") {
        throw new VolcImageApiError("Request timed out");
      }

      if (attempt < MAX_RETRIES) {
        console.warn(`Volc Image API attempt ${attempt} failed, retrying...`, error);
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  clearTimeout(timeoutId);
  throw new VolcImageApiError(
    `Failed after ${MAX_RETRIES} attempts: ${lastError?.message}`
  );
}

export async function generateImageBuffer(
  prompt: string,
  style?: string,
  options?: {
    size?: "1K" | "2K";
  }
): Promise<Buffer> {
  const base64Data = await generateImage(prompt, style, options);
  return Buffer.from(base64Data, "base64");
}

export async function regenerateImage(
  prompt: string,
  style?: string,
  options?: {
    size?: "1K" | "2K";
  }
): Promise<string> {
  return generateImage(prompt, style, options);
}
