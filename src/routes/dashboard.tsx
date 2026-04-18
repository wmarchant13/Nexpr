import { createFileRoute, redirect } from "@tanstack/react-router";
import Dashboard from "../components/Dashboard";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !localStorage.getItem("accessToken")) {
      throw redirect({ to: "/", replace: true });
    }
  },
  component: Dashboard,
});
