import type { ApiError } from "../../packages/contracts";

export class ApiFailure extends Error {
 constructor(message:string, public readonly status:number | null, public readonly code:string, public readonly issues: {path:string;message:string}[] = []) { super(message); this.name='ApiFailure'; }
}

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
    if (response.status === 204) return undefined as T;
    if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:;|$)/i.test(response.headers.get('Content-Type') || '')) throw new ApiFailure('The shop service returned an unreadable response. Please try again.', response.status, 'INVALID_RESPONSE');
    let data: any;
    try { data = await response.json(); } catch { throw new ApiFailure('The shop service returned an unreadable response. Please try again.', response.status, 'INVALID_RESPONSE'); }
    if (!response.ok)
      throw new ApiFailure((typeof data?.error === 'string' ? data.error : '') || 'The service could not complete that request. Please try again.', response.status, typeof data?.code === 'string' ? data.code : 'HTTP_ERROR', Array.isArray(data?.issues) ? data.issues : []);
    return data as T;
  } catch (error) {
    if (
      error instanceof TypeError ||
      (error instanceof DOMException && error.name === "AbortError")
    )
      throw new ApiFailure("We could not reach the shop service. Your bag is saved; please try again.", null, error instanceof TypeError ? "NETWORK_ERROR" : "REQUEST_TIMEOUT");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
