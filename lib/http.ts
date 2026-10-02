/**
 * One error type for everything the user can see. Messages are written for a
 * human; stack traces and upstream payloads never leave the server.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly hint?: string;

  constructor(message: string, status = 400, hint?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.hint = hint;
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { error: error.message, ...(error.hint ? { hint: error.hint } : {}) },
      { status: error.status },
    );
  }
  // Unknown failure: log server-side, return a generic message.
  console.error("[jobmatch] unhandled error:", error);
  return Response.json(
    { error: "Something went wrong on our side. Please try again." },
    { status: 500 },
  );
}

/** fetch + JSON with a timeout. Upstream failures become user-readable ApiErrors. */
export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 12_000,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "application/json", ...(init.headers ?? {}) },
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new ApiError(
      timedOut
        ? "The job service did not respond in time. Please try again."
        : "Could not reach the job service.",
      504,
    );
  }
  if (!response.ok) {
    throw new ApiError(`The job service responded with an error (${response.status}).`, 502);
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError("The job service returned a response we could not read.", 502);
  }
}