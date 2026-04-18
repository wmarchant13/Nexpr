import { createFileRoute } from "@tanstack/react-router";
import CallbackPage from "../components/CallbackPage";

export const Route = createFileRoute("/auth/strava/callback")({
  component: CallbackPage,
});
