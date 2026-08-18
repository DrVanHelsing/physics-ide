/**
 * Minimal JSON API client. Cookies ride along (same-origin);
 * every non-2xx becomes an ApiError carrying the server's message.
 */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api(path, { method = "GET", body } = {}) {
  const opts = { method, credentials: "same-origin", headers: {} };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message =
      data && typeof data.error === "string"
        ? data.error
        : `Something went wrong (HTTP ${res.status}).`;
    throw new ApiError(message, res.status);
  }
  return data;
}
