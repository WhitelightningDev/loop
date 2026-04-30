export type FetchJsonInit = Omit<RequestInit, "body"> & {
  json?: unknown;
  accessToken?: string | null;
};

export async function fetchJson<T>(input: string, init?: FetchJsonInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");

  const accessToken = init?.accessToken;
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let body: BodyInit | undefined;
  if (init && init.json !== undefined && init.json !== null) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }

  const res = await fetch(input, { ...init, headers, body });
  if (res.ok) return (await res.json()) as T;

  let message = `${res.status} ${res.statusText}`;
  try {
    const j = (await res.json()) as { error?: string; message?: string };
    message = j.error || j.message || message;
  } catch {
    // ignore
  }
  throw new Error(message);
}
