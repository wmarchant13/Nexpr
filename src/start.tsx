import { createMiddleware, createStart } from "@tanstack/react-start";
import { isbot } from "isbot";

const botProtectionMiddleware = createMiddleware({ type: "request" }).server(
  async ({ next, pathname, request }) => {
    if (!shouldInspectRequest(pathname, request)) {
      return next();
    }

    const userAgent = request.headers.get("user-agent") ?? "";

    if (isBlockedBot(userAgent)) {
      return new Response("Forbidden", {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    return next();
  },
);

function shouldInspectRequest(pathname: string, request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  if (
    pathname.startsWith("/_server") ||
    pathname.startsWith("/api/strava/webhook") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/.well-known/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return false;
  }

  const accept = request.headers.get("accept") ?? "";
  const destination = request.headers.get("sec-fetch-dest") ?? "";

  return accept.includes("text/html") || destination === "document" || destination === "empty";
}

function isBlockedBot(userAgent: string) {
  if (!userAgent) {
    return false;
  }

  const normalized = userAgent.toLowerCase();

  return (
    isbot(userAgent) ||
    normalized.includes("headless") ||
    normalized.includes("python-requests") ||
    normalized.includes("curl/") ||
    normalized.includes("wget/") ||
    normalized.includes("httpclient") ||
    normalized.includes("go-http-client") ||
    normalized.includes("node-fetch") ||
    normalized.includes("axios/")
  );
}

export const startInstance = createStart(() => ({
  requestMiddleware: [botProtectionMiddleware],
}));