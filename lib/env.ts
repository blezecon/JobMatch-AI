import type { AiStatus } from "@/types";
import { ApiError } from "./http";

export type AiProvider = "ollama" | "llamacpp" | "groq" | "openrouter";

export type AiConfig = {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  apiKey: string | null;
  /** Local inference keeps the resume on this machine; nothing is sent to a cloud provider. */
  local: boolean;
};

/**
 * All four backends speak the OpenAI-compatible `/chat/completions` API, so the
 * app only ever talks to one shape. Ollama and llama.cpp server ship it locally;
 * Groq and OpenRouter host the same open-weight models.
 */
const BACKENDS: Record<AiProvider, { baseUrl: string; model: string; keyVar: string | null }> = {
  ollama: { baseUrl: "http://localhost:11434/v1", model: "gemma3:4b", keyVar: null },
  llamacpp: { baseUrl: "http://localhost:8080/v1", model: "local-model", keyVar: null },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-20b", keyVar: "GROQ_API_KEY" },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "google/gemma-3-27b-it",
    keyVar: "OPENROUTER_API_KEY",
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

  // OLLAMA_* keeps its conventional name; AI_BASE_URL / AI_MODEL override anything.
  const defaultBaseUrl =
    requested === "ollama" ? (process.env.OLLAMA_BASE_URL ?? backend.baseUrl) : backend.baseUrl;
  const defaultModel =
    requested === "ollama" ? (process.env.OLLAMA_MODEL ?? backend.model) : backend.model;

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
};