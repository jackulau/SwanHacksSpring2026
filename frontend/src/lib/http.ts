// Tiny shared helpers for hitting custom PB hook endpoints. The PB
// SDK only covers /api/collections/* — anything custom we add via
// routerAdd has to be reached with raw fetch, but those routes
// expect the user's auth token on the Authorization header so
// `e.requestInfo().auth` resolves on the server side. Centralising
// the header construction keeps every caller honest.

import { pb } from "./pocketbase";

export function pbAuthedHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extra ?? {}),
  };
  const tok = pb.authStore?.token;
  if (tok) headers.Authorization = tok;
  return headers;
}

export interface HookFetchOptions {
  signal?: AbortSignal;
  /** Extra headers to merge on top of the auth + content-type headers. */
  headers?: Record<string, string>;
}

/**
 * POST a JSON body to a server-side hook (under /api/...) and parse
 * the JSON response. Throws on non-2xx with a useful error.
 */
export async function postHook<TReq, TRes>(
  path: string,
  body: TReq,
  opts: HookFetchOptions = {},
): Promise<TRes> {
  const res = await fetch(path, {
    method: "POST",
    headers: pbAuthedHeaders(opts.headers),
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${path} -> HTTP ${res.status}${text ? ": " + text : ""}`);
  }
  return (await res.json()) as TRes;
}
