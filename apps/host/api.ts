import type { ApiError } from "../../packages/contracts";

export async function api<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        (data as ApiError).error ||
          "The service could not complete that request. Please try again.",
      );
    return data as T;
  } catch (error) {
    if (
      error instanceof TypeError ||
      (error instanceof DOMException && error.name === "AbortError")
    )
      throw new Error(
        "We could not reach the shop service. Your bag is saved; please try again.",
      );
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
