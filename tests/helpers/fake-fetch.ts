export interface RecordedRequest {
  method: string;
  url: URL;
  headers: Record<string, string>;
  body: string | undefined;
  redirect: RequestInit['redirect'];
}

export interface FakeResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

/** `fetch` falso que registra cada solicitud y responde con `handler`. */
export function fakeFetch(handler: (req: RecordedRequest) => FakeResponse): {
  fetch: typeof fetch;
  calls: RecordedRequest[];
} {
  const calls: RecordedRequest[] = [];
  const fn = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const href = input instanceof Request ? input.url : input.toString();
    const req: RecordedRequest = {
      method: init?.method ?? 'GET',
      url: new URL(href),
      headers: { ...(init?.headers as Record<string, string> | undefined) },
      body: typeof init?.body === 'string' ? init.body : undefined,
      redirect: init?.redirect,
    };
    calls.push(req);
    const r = handler(req);
    const text =
      r.body === undefined ? null : typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    return Promise.resolve(
      new Response(text, {
        status: r.status ?? 200,
        headers: { 'content-type': 'application/json', ...r.headers },
      }),
    );
  };
  return { fetch: fn, calls };
}
