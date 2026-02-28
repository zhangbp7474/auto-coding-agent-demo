import { getVolcEngineConfig } from "@/lib/config";
import type {
  SceneDescription,
  StoryToScenesResult,
} from "@/types/ai";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 60000;

export class VolcTextApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorCode?: string
  ) {
    super(message);
    this.name = "VolcTextApiError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isVolcTextConfigured(): boolean {
  const config = getVolcEngineConfig();
  return !!config.api_key && config.api_key !== "YOUR_VOLC_API_KEY_HERE";
}

const STORY_TO_SCENES_SYSTEM_PROMPT = `你是一个专业的视频脚本编剧。你的任务是将用户提供的短故事拆分成适合制作短视频的独立场景。

## 输出要求
1. 将故事拆分为 4-8 个场景（根据故事长度调整）
2. 每个场景应该：
   - 有清晰的视觉描述
   - 包含场景中的人物、动作、环境
   - 适合 5-10 秒的视频展示
   - 场景之间有连贯性

3. 必须以 JSON 格式输出，格式如下：
{
  "scenes": [
    {
      "order_index": 1,
      "description": "场景的详细视觉描述"
    }
  ]
}

## 注意事项
- 不要输出任何额外文字，只输出 JSON
- 确保每个场景描述足够详细，可以用于生成图片
- 场景描述应该包含：场景环境、人物动作、情绪氛围、光影效果`;

function buildStyleGuidance(style?: string): string {
  const styleMap: Record<string, string> = {
    realistic: "风格指导：写实风格，真实感强，自然光影",
    anime: "风格指导：日本动漫风格，色彩鲜艳，线条清晰",
    cartoon: "风格指导：卡通风格，夸张可爱，色彩明亮",
    cinematic: "风格指导：电影质感，大气磅礴，专业运镜",
    watercolor: "风格指导：水彩画风格，柔和淡雅，艺术感强",
    oil_painting: "风格指导：油画风格，厚重质感，色彩浓郁",
    sketch: "风格指导：素描风格，线条为主，黑白灰调",
    cyberpunk: "风格指导：赛博朋克风格，霓虹灯光，科技感",
    fantasy: "风格指导：奇幻风格，魔法元素，梦幻色彩",
    scifi: "风格指导：科幻风格，未来感，高科技元素",
  };

  if (style && styleMap[style]) {
    return `\n${styleMap[style]}`;
  }
  return "\n风格指导：写实风格";
}

function parseScenesJson(content: string): StoryToScenesResult {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new VolcTextApiError("Failed to parse scenes from response: no JSON found");
  }

  try {
    const result = JSON.parse(jsonMatch[0]) as StoryToScenesResult;

    if (!result.scenes || !Array.isArray(result.scenes)) {
      throw new VolcTextApiError("Invalid response structure: missing scenes array");
    }

    result.scenes = result.scenes.map((scene, index) => ({
      order_index: scene.order_index ?? index + 1,
      description: scene.description,
    }));

    return result;
  } catch (e) {
    if (e instanceof VolcTextApiError) throw e;
    throw new VolcTextApiError(`Failed to parse JSON: ${e instanceof Error ? e.message : "Unknown error"}`);
  }
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
    code: string;
  };
}

async function chatCompletion(
  messages: Array<{ role: string; content: string }>,
  options: {
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<ChatCompletionResponse> {
  const config = getVolcEngineConfig();
  
  if (!config.api_key) {
    throw new VolcTextApiError("VOLC_API_KEY is not configured");
  }

  const requestBody = {
    model: config.text.model,
    messages,
    temperature: options.temperature ?? config.text.temperature,
    max_tokens: options.maxTokens ?? config.text.max_tokens,
    stream: false,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(config.text.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.api_key}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      const data: ChatCompletionResponse = await response.json();

      if (data.error) {
        throw new VolcTextApiError(
          data.error.message || `API error: ${data.error.code}`,
          response.status,
          data.error.code
        );
      }

      if (!response.ok) {
        throw new VolcTextApiError(
          `HTTP error ${response.status}`,
          response.status
        );
      }

      clearTimeout(timeoutId);
      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");

      if (error instanceof VolcTextApiError) {
        if (error.statusCode === 401 || error.statusCode === 403) {
          throw error;
        }
      }

      if ((error as Error).name === "AbortError") {
        throw new VolcTextApiError("Request timed out");
      }

      if (attempt < MAX_RETRIES) {
        console.warn(`Volc Text API attempt ${attempt} failed, retrying...`, error);
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  clearTimeout(timeoutId);
  throw new VolcTextApiError(
    `Failed after ${MAX_RETRIES} attempts: ${lastError?.message}`
  );
}

export async function storyToScenes(
  story: string,
  style?: string
): Promise<SceneDescription[]> {
  const styleGuidance = buildStyleGuidance(style);
  const userPrompt = `请将以下故事拆分为视频场景：\n\n${story}\n\n${styleGuidance}`;

  const messages = [
    { role: "system", content: STORY_TO_SCENES_SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  const response = await chatCompletion(messages, {
    temperature: 0.8,
    maxTokens: 4096,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new VolcTextApiError("Empty response from model");
  }

  const result = parseScenesJson(content);
  return result.scenes;
}

export async function regenerateScenes(
  story: string,
  style?: string,
  previousScenes?: SceneDescription[],
  feedback?: string
): Promise<SceneDescription[]> {
  const styleGuidance = buildStyleGuidance(style);

  let additionalContext = "";
  if (previousScenes && previousScenes.length > 0) {
    additionalContext += `\n\n之前生成的场景（供参考）：\n${previousScenes
      .map((s) => `场景 ${s.order_index}: ${s.description}`)
      .join("\n")}`;
  }

  if (feedback) {
    additionalContext += `\n\n用户反馈（请根据此改进）：${feedback}`;
  }

  const userPrompt = `请将以下故事拆分为视频场景${additionalContext}：\n\n${story}\n\n${styleGuidance}`;

  const messages = [
    { role: "system", content: STORY_TO_SCENES_SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  const response = await chatCompletion(messages, {
    temperature: 0.9,
    maxTokens: 4096,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new VolcTextApiError("Empty response from model");
  }

  const result = parseScenesJson(content);
  return result.scenes;
}
