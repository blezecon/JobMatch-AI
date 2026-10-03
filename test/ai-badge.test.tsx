import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { AiStatusBadge } from "@/components/Badges";
import type { AiStatus } from "@/types";

afterEach(cleanup);

const ready: AiStatus = {
  provider: "llamacpp",
  model: "local-model",
  baseUrl: "http://192.168.29.136:8080/v1",
  configured: true,
  reachable: true,
  error: null,
};

it("lists every backend, not just the active one", () => {
  render(<AiStatusBadge status={ready} backends={["ollama", "llamacpp", "openrouter"]} />);
  // The icon splits the label into sibling text nodes.
  expect(screen.getByText(/ollama \/ llamacpp \/ openrouter/)).toBeTruthy();
});

it("keeps the active backend and model in the tooltip", () => {
  render(<AiStatusBadge status={ready} backends={["ollama", "llamacpp", "openrouter"]} />);
  const badge = screen.getByTitle("Active: llamacpp / local-model");
  expect(badge.textContent).toMatch(/ready/);
});

it("falls back to the active provider when the backend list is missing", () => {
  render(<AiStatusBadge status={ready} />);
  expect(screen.getByText(/llamacpp/)).toBeTruthy();
});

it("still reports the failure when a backend is unreachable", () => {
  render(
    <AiStatusBadge
      status={{ ...ready, reachable: false, error: "Could not reach the AI backend." }}
      backends={["ollama", "llamacpp", "openrouter"]}
    />,
  );
  expect(screen.getByText(/not ready: could not reach/i)).toBeTruthy();
});