import type { IncomingMessage, ServerResponse } from "node:http";

export function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export function sendError(res: ServerResponse, status: number, message: string) {
  sendJson(res, status, { error: message });
}

export function methodNotAllowed(res: ServerResponse, allowed: string[]) {
  res.setHeader("Allow", allowed.join(", "));
  sendError(res, 405, "method_not_allowed");
}

export async function readJsonBody<T>(req: IncomingMessage & { body?: unknown }): Promise<T> {
  if (req.body !== undefined) {
    if (typeof req.body === "string") return JSON.parse(req.body) as T;
    return req.body as T;
  }

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))));
    req.on("end", resolve);
    req.on("error", reject);
  });
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
}

