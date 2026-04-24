import { createFileRoute } from "@tanstack/react-router";
import {
  deleteAthleteActivityData,
  deleteAthleteAppData,
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

function jsonResponse(body: unknown, status: number = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

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

        if (
          mode !== "subscribe" ||
          !challenge ||
          verifyToken !== process.env.STRAVA_WEBHOOK_VERIFY_TOKEN
        ) {
          return jsonResponse({ error: "Invalid webhook verification request" }, 403);
        }

        return jsonResponse({ "hub.challenge": challenge });
      },
      POST: async ({ request }) => {
        const payload = (await request.json().catch(() => null)) as StravaWebhookEvent | null;
        if (!payload) {
          return jsonResponse({ error: "Invalid webhook payload" }, 400);
        }

        const athleteId = Number(payload.owner_id ?? payload.object_id ?? 0);
        const activityId = Number(payload.object_id ?? 0);
        const isAthleteDeauth =
          payload.object_type === "athlete" &&
          (payload.aspect_type === "delete" || payload.updates?.authorized === "false");
        const isActivityDelete =
          payload.object_type === "activity" && payload.aspect_type === "delete";

        if (isAthleteDeauth && Number.isFinite(athleteId) && athleteId > 0) {
          await deleteAthleteAppData(athleteId);
        }

        if (
          isActivityDelete &&
          Number.isFinite(athleteId) &&
          athleteId > 0 &&
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