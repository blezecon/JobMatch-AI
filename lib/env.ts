import type { AiStatus } from "@/types";
import { ApiError } from "./http";

type AiProvider = "ollama" | "llamacpp" | "openrouter";

export type AiConfig = {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  apiKey: string | null;
  /** Local inference keeps the resume on this machine; nothing is sent to a cloud provider. */
  local: boolean;
};

/**
 * All three backends speak the OpenAI-compatible `/chat/completions` API, so the
 * app only ever talks to one shape. Ollama and llama.cpp server ship it locally;
 * OpenRouter hosts the same open-weight models remotely.
 */
const BACKENDS: Record<
  AiProvider,
  { baseUrl: string; model: string; keyVar: string | null; envPrefix: string }
> = {
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    model: "gemma3:4b",
    keyVar: null,
    envPrefix: "OLLAMA",
  },
  llamacpp: {
    baseUrl: "http://localhost:8080/v1",
    model: "local-model",
    keyVar: null,
    envPrefix: "LLAMACPP",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "google/gemma-3-27b-it",
    keyVar: "OPENROUTER_API_KEY",
    envPrefix: "OPENROUTER",
  },
};

function resolve(): { config: AiConfig | null; error: ApiError | null } {
  const requested = (process.env.AI_PROVIDER ?? "ollama").trim().toLowerCase();
  const backend = BACKENDS[requested as AiProvider];
  if (!backend) {
    return {
      config: null,
      error: new ApiError(
        `AI_PROVIDER="${requested}" is not a supported backend.`,
        500,
        `Use one of: ${Object.keys(BACKENDS).join(", ")}.`,
      ),
    };
  }

  // Every backend honours <PREFIX>_BASE_URL / <PREFIX>_MODEL, so OLLAMA_BASE_URL,
  // LLAMACPP_BASE_URL and OPENROUTER_BASE_URL all work.
  // AI_BASE_URL / AI_MODEL are the generic overrides and win over both.
  const defaultBaseUrl = process.env[`${backend.envPrefix}_BASE_URL`] ?? backend.baseUrl;
  const defaultModel = process.env[`${backend.envPrefix}_MODEL`] ?? backend.model;

  const baseUrl = (process.env.AI_BASE_URL ?? defaultBaseUrl).replace(/\/+$/, "");
  const model = (process.env.AI_MODEL ?? defaultModel).trim();
  const apiKey = backend.keyVar ? (process.env[backend.keyVar] ?? "").trim() || null : null;

  if (backend.keyVar && !apiKey) {
    return {
      config: null,
      error: new ApiError(
        `No API key found for the "${requested}" AI backend.`,
        500,
        `Add ${backend.keyVar}=... to .env.local, or set AI_PROVIDER=ollama to run locally.`,
      ),
    };
  }
  if (!model) {
    return {
      config: null,
      error: new ApiError("No AI model configured.", 500, "Set AI_MODEL to a model your backend serves."),
    };
  }

  return {
    config: {
      provider: requested as AiProvider,
      baseUrl,
      model,
      apiKey,
      local: requested === "ollama" || requested === "llamacpp",
    },
    error: null,
  };
}

/** Config for a request that needs the model. Throws a user-readable error if unset. */
export function requireAiConfig(): AiConfig {
  const { config, error } = resolve();
  if (!config) throw error ?? new ApiError("AI backend is not configured.", 500);
  return config;
}

/** Every backend the app supports, in display order. */
export const AI_BACKENDS: AiProvider[] = Object.keys(BACKENDS) as AiProvider[];

/** Config for status display: never throws, so the UI can explain what is missing. */
export function describeAi(): AiStatus {
  const { config, error } = resolve();
  if (!config) {
    return {
      provider: (process.env.AI_PROVIDER ?? "ollama").toLowerCase(),
      model: process.env.AI_MODEL ?? "",
      baseUrl: "",
      configured: false,
      reachable: null,
      error: error?.message ?? "AI backend is not configured.",
    };
  }
  return {
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    configured: true,
    reachable: null,
    error: null,
  };
}

const num = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const LIMITS = {
  /** Resume PDFs above this are rejected before any parsing happens. */
  maxResumeBytes: num(process.env.MAX_RESUME_BYTES, 5 * 1024 * 1024),
  /** Local CPU inference is slow; cloud backends answer well inside this. */
  aiTimeoutMs: num(process.env.AI_TIMEOUT_MS, 180_000),
  jobTimeoutMs: num(process.env.JOB_TIMEOUT_MS, 12_000),
  /**
   * Context window requested from local servers. llama.cpp and Ollama often boot
   * with 4k-8k; a resume plus a job listing can exceed that, so we ask for a
   * known size and keep prompts inside it.
   */
  aiNumCtx: num(process.env.AI_NUM_CTX, 16384),
};