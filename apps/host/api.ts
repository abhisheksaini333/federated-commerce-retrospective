import { validApiResponse } from '../../packages/contracts/responses';
import type { ApiError } from "../../packages/contracts";

export class ApiFailure extends Error {
 constructor(message:string, public readonly status:number | null, public readonly code:string, public readonly issues: {path:string;message:string}[] = []) { super(message); this.name='ApiFailure'; }
}

export interface ApiOptions extends RequestInit { timeoutMs?: number }
export async function api<T>(
  url: string,
  options: ApiOptions = {},
): Promise<T> {
  const controller = new AbortController();
  if (options.signal?.aborted) throw new ApiFailure('The request was cancelled.', null, 'REQUEST_CANCELLED');
  const timeoutMs = options.timeoutMs ?? 5000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new ApiFailure('The request timeout is invalid.', null, 'INVALID_TIMEOUT');
  let callerCancelled = false;
  const cancel = () => { callerCancelled = true; controller.abort(); };
  options.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = new Headers(options.headers);
    if (options.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers,
    });
    if (response.status === 204) return undefined as T;
    if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:;|$)/i.test(response.headers.get('Content-Type') || '')) throw new ApiFailure('The shop service returned an unreadable response. Please try again.', response.status, 'INVALID_RESPONSE');
    let data: any;
    try { data = await response.json(); } catch { throw new ApiFailure('The shop service returned an unreadable response. Please try again.', response.status, 'INVALID_RESPONSE'); }
    if (!response.ok)
      throw new ApiFailure((typeof data?.error === 'string' ? data.error : '') || 'The service could not complete that request. Please try again.', response.status, typeof data?.code === 'string' ? data.code : 'HTTP_ERROR', Array.isArray(data?.issues) ? data.issues : []);
    if (!validApiResponse(url, data)) throw new ApiFailure('The shop service returned invalid data. Please try again.', response.status, 'INVALID_RESPONSE');
    return data as T;
  } catch (error) {
    if (
      error instanceof TypeError ||
      (error instanceof DOMException && error.name === "AbortError")
    )
      throw new ApiFailure("We could not reach the shop service. Your bag is saved; please try again.", null, error instanceof TypeError ? "NETWORK_ERROR" : callerCancelled ? "REQUEST_CANCELLED" : "REQUEST_TIMEOUT");
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}
