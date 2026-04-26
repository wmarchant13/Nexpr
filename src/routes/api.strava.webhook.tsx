import { createFileRoute } from "@tanstack/react-router";
import {
  deleteAthleteActivityData,
  deleteAthleteAppData,
  markAthleteWebhookHit,
} from "../utils/server/stravaSession";

type StravaWebhookEvent = {
  aspect_type?: string;
  object_type?: string;
  object_id?: number;
  owner_id?: number;
  updates?: {
    authorized?: string;
  };
};

// Json Response
function jsonResponse(body: unknown, status: number = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

// Parses positive int
function parsePositiveInt(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export const Route = createFileRoute("/api/strava/webhook")({
  component: () => null,
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const verifyToken = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        const expectedToken =
          process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ??
          (globalThis as Record<string, any>).__env__?.STRAVA_WEBHOOK_VERIFY_TOKEN;

        if (
          mode !== "subscribe" ||
          !challenge ||
          !expectedToken ||
          verifyToken !== expectedToken
        ) {
          return jsonResponse({ error: "Invalid webhook verification request" }, 403);
        }

        return jsonResponse({ "hub.challenge": challenge });
      },
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const expectedToken =
          process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ??
          (globalThis as Record<string, any>).__env__?.STRAVA_WEBHOOK_VERIFY_TOKEN;
        const postToken =
          url.searchParams.get("verify_token") ??
          url.searchParams.get("hub.verify_token");

        if (!expectedToken || postToken !== expectedToken) {
          return jsonResponse({ error: "Unauthorized webhook request" }, 403);
        }

        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("application/json")) {
          return jsonResponse({ error: "Unsupported webhook content type" }, 415);
        }

        // Payload
        const payload = (await request.json().catch(() => null)) as StravaWebhookEvent | null;
        if (!payload) {
          return jsonResponse({ error: "Invalid webhook payload" }, 400);
        }

        if (payload.object_type !== "activity" && payload.object_type !== "athlete") {
          return jsonResponse({ error: "Unsupported webhook object type" }, 400);
        }

        const athleteId = Number(payload.owner_id ?? payload.object_id ?? 0);
        const activityId = Number(payload.object_id ?? 0);

        if (!Number.isFinite(athleteId) || athleteId <= 0) {
          return jsonResponse({ error: "Invalid webhook owner id" }, 400);
        }

        const isAthleteDeauth =
          payload.object_type === "athlete" &&
          (payload.aspect_type === "delete" || payload.updates?.authorized === "false");
        const isActivityEvent =
          payload.object_type === "activity" &&
          Number.isFinite(athleteId) &&
          athleteId > 0;
        const isActivityDelete =
          isActivityEvent && payload.aspect_type === "delete";

        if (isAthleteDeauth && Number.isFinite(athleteId) && athleteId > 0) {
          await deleteAthleteAppData(athleteId);
        }

        if (isActivityEvent) {
          await markAthleteWebhookHit(athleteId);
        }

        if (
          isActivityDelete &&
          Number.isFinite(activityId) &&
          activityId > 0
        ) {
          await deleteAthleteActivityData(athleteId, activityId);
        }

        return jsonResponse({ ok: true });
      },
    },
  },
});