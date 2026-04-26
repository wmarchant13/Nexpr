import { createMiddleware, createStart } from "@tanstack/react-start";
import { isbot } from "isbot";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitKey,
  limitForPath,
} from "./utils/server/rateLimit";

// Rate limit middleware for all dynamic routes, including /_server RPC.
const rateLimitMiddleware = createMiddleware({ type: "request" }).server(
  async ({ next, pathname, request }) => {
    if (
      pathname.startsWith("/assets/") ||
      pathname === "/favicon.ico"
    ) {
      return next();
    }

    const ip = getClientIp(request);
    const key = getRateLimitKey(request, pathname, ip);
    const limit = limitForPath(pathname);
    const { allowed, remaining, resetAt } = checkRateLimit(key, limit);

    if (!allowed) {
      return new Response("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    const response = await next();
    if (response instanceof Response) {
      response.headers.set("X-RateLimit-Limit", String(limit));
      response.headers.set("X-RateLimit-Remaining", String(remaining));

      if (pathname.startsWith("/_server")) {
        response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      }
    }
    return response;
  },
);

// Mutation guard for /_server writes to reduce cross-site and scripted abuse.
const mutationGuardMiddleware = createMiddleware({ type: "request" }).server(
  async ({ next, pathname, request }) => {
    const method = request.method.toUpperCase();
    const isMutation = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";

    if (!pathname.startsWith("/_server") || !isMutation) {
      return next();
    }

    const expectedOrigin = new URL(request.url).origin;
    const origin = request.headers.get("origin");
    const secFetchSite = request.headers.get("sec-fetch-site");

    if (!origin || origin !== expectedOrigin) {
      return new Response("Forbidden", {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
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

// Bot Protection Middleware
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

// Returns true if the request needs bot-detection inspection
function shouldInspectRequest(pathname: string, request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  if (
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

// Returns true if the user-agent matches a known bot pattern
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
  requestMiddleware: [rateLimitMiddleware, mutationGuardMiddleware, botProtectionMiddleware],
}));