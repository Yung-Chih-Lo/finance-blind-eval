import { MODEL_IDS } from "./researchConfig";
import type { AnswerLabel, ModelAnswer, ModelId, PromptCategory } from "./types";

const ANSWER_LABELS: AnswerLabel[] = ["A", "B", "C"];
const MODEL_HINTS: Record<ModelId, RegExp[]> = {
  "H1-best": [/h1/i, /apt/i],
  "H2-best": [/h2/i, /slp/i],
  "TAIDE-baseline": [/taide/i, /baseline/i],
};

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
    text?: string;
  }>;
}

interface ModelListResponse {
  data?: Array<{
    id?: string;
  }>;
}

let resolvedModelNames: Promise<Record<ModelId, string>> | null = null;

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffleModels(seed: string): ModelId[] {
  const values = [...MODEL_IDS];
  let state = hashSeed(seed);

  for (let index = values.length - 1; index > 0; index -= 1) {
    state = Math.imul(state ^ (state >>> 15), 2246822507) >>> 0;
    const swapIndex = state % (index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }

  return values;
}

function modelTone(modelId: ModelId): string {
  if (modelId === "H1-best") {
    return "先界定前提，再把金融機制、風險來源與可驗證指標拆開回答。";
  }
  if (modelId === "H2-best") {
    return "以條列方式整理判斷步驟，並補充實務上容易誤判的地方。";
  }
  return "提供一般性的說明與注意事項，但部分細節需要再用資料或課本定義確認。";
}

function buildAnswer(modelId: ModelId, category: PromptCategory, question: string): string {
  const topic = question.trim().replace(/\s+/g, " ");
  const emphasis =
    modelId === "TAIDE-baseline"
      ? "若要下結論，建議再補充時間區間、標的、資料來源與風險承受度。"
      : "較好的回答應該避免單點結論，並說明哪些條件改變時判斷會反轉。";

  return [
    `${modelTone(modelId)}`,
    `針對「${topic}」，我會先把它放在「${category.title}」脈絡下看：核心不是只回答名詞，而是釐清假設、現金流或價格形成機制，以及可觀察的佐證資料。`,
    `判斷時可以依序檢查三件事：第一，題目中的金融變數是否有明確定義；第二，因果關係是否可能被利率、匯率、景氣循環或公司體質混淆；第三，答案是否有指出限制，而不是直接給投資建議。`,
    emphasis,
  ].join("\n\n");
}

function getAuthHeaders(includeContentType = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }
  const apiKey = import.meta.env.VITE_OPENAI_COMPAT_API_KEY;
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function getModelOverrides(): Partial<Record<ModelId, string>> {
  return {
    "H1-best": import.meta.env.VITE_OPENAI_COMPAT_MODEL_H1,
    "H2-best": import.meta.env.VITE_OPENAI_COMPAT_MODEL_H2,
    "TAIDE-baseline": import.meta.env.VITE_OPENAI_COMPAT_MODEL_TAIDE,
  };
}

function deriveModelsEndpoint(chatEndpoint: string): string {
  if (import.meta.env.VITE_OPENAI_COMPAT_MODELS_ENDPOINT) {
    return import.meta.env.VITE_OPENAI_COMPAT_MODELS_ENDPOINT;
  }

  const url = new URL(chatEndpoint, window.location.href);
  url.pathname = url.pathname.replace(/\/chat\/completions\/?$/, "/models");
  return url.toString();
}

function inferModelName(modelId: ModelId, availableModelIds: string[], used: Set<string>): string | undefined {
  const override = getModelOverrides()[modelId];
  if (override) {
    return override;
  }

  return availableModelIds.find((candidate) => {
    if (used.has(candidate)) {
      return false;
    }
    return MODEL_HINTS[modelId].some((pattern) => pattern.test(candidate));
  });
}

function buildModelMapping(availableModelIds: string[]): Record<ModelId, string> {
  const used = new Set<string>();
  const mapping = {} as Record<ModelId, string>;

  MODEL_IDS.forEach((modelId) => {
    const matched = inferModelName(modelId, availableModelIds, used);
    if (matched) {
      mapping[modelId] = matched;
      used.add(matched);
    }
  });

  if (availableModelIds.length === MODEL_IDS.length) {
    MODEL_IDS.forEach((modelId, index) => {
      if (!mapping[modelId]) {
        const fallback = availableModelIds.find((candidate) => !used.has(candidate)) ?? availableModelIds[index];
        mapping[modelId] = fallback;
        used.add(fallback);
      }
    });
  }

  const missing = MODEL_IDS.filter((modelId) => !mapping[modelId]);
  if (missing.length > 0) {
    throw new Error(
      [
        `從 /v1/models 抓到 ${availableModelIds.length} 個模型，但無法自動對應：${missing.join(", ")}。`,
        "若 gateway 內模型超過 3 個，請用 VITE_OPENAI_COMPAT_MODEL_H1 / H2 / TAIDE 指定。",
      ].join(" "),
    );
  }

  return mapping;
}

async function getGatewayModelNames(chatEndpoint: string): Promise<Record<ModelId, string>> {
  if (!resolvedModelNames) {
    resolvedModelNames = (async () => {
      const modelsEndpoint = deriveModelsEndpoint(chatEndpoint);
      const response = await fetch(modelsEndpoint, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Models endpoint ${response.status}: ${detail.slice(0, 240)}`);
      }
      const data = (await response.json()) as ModelListResponse;
      const modelIds = data.data?.map((model) => model.id).filter((id): id is string => Boolean(id)) ?? [];
      if (modelIds.length < MODEL_IDS.length) {
        throw new Error(`/v1/models 至少需要回傳 3 個模型，目前只有 ${modelIds.length} 個。`);
      }
      return buildModelMapping(modelIds);
    })();
  }
  return resolvedModelNames;
}

async function requestOpenAICompatibleAnswer(params: {
  endpoint: string;
  gatewayModelName: string;
  modelId: ModelId;
  category: PromptCategory;
  question: string;
}): Promise<string> {
  const response = await fetch(params.endpoint, {
    method: "POST",
    headers: getAuthHeaders(true),
    body: JSON.stringify({
      model: params.gatewayModelName,
      temperature: Number(import.meta.env.VITE_OPENAI_COMPAT_TEMPERATURE ?? "0.2"),
      messages: [
        {
          role: "system",
          content:
            "你是金融問答模型。請用繁體中文回答受測者問題，保持專業、清楚、可比較。不要提到模型名稱、盲測、A/B/C 或你正在被評估。",
        },
        {
          role: "user",
          content: [
            `題型：${params.category.title}`,
            `題型引導：${params.category.instruction}`,
            `受測者問題：${params.question}`,
          ].join("\n"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LLM endpoint ${response.status}: ${detail.slice(0, 240)}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const answer = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text;
  if (!answer?.trim()) {
    throw new Error("LLM endpoint 回傳格式缺少 choices[0].message.content。");
  }

  return answer.trim();
}

export async function requestBlindAnswers(params: {
  participantToken: string;
  questionIndex: number;
  category: PromptCategory;
  question: string;
}): Promise<{ answers: ModelAnswer[]; latencyMs: number }> {
  const startedAt = performance.now();
  const orderedModels = shuffleModels(
    `${params.participantToken}:${params.questionIndex}:${params.category.id}:${params.question}`,
  );
  const endpoint = import.meta.env.VITE_OPENAI_COMPAT_API_ENDPOINT;
  if (endpoint) {
    const gatewayModelNames = await getGatewayModelNames(endpoint);
    const answers = await Promise.all(
      orderedModels.map(async (modelId, index) => ({
        label: ANSWER_LABELS[index],
        modelId,
        text: await requestOpenAICompatibleAnswer({
          endpoint,
          gatewayModelName: gatewayModelNames[modelId],
          modelId,
          category: params.category,
          question: params.question,
        }),
      })),
    );

    return {
      answers,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  }

  const answers = orderedModels.map((modelId, index) => ({
    label: ANSWER_LABELS[index],
    modelId,
    text: buildAnswer(modelId, params.category, params.question),
  }));

  await new Promise((resolve) => window.setTimeout(resolve, 420));

  return {
    answers,
    latencyMs: Math.round(performance.now() - startedAt),
  };
}
