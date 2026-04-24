import { createFileRoute, redirect } from "@tanstack/react-router";
import { getViewerSession } from "../api/auth";
import LoginPage from "../components/LoginPage";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await getViewerSession();
    if (session.authenticated) {
      throw redirect({ to: "/dashboard", replace: true });
    }
  },
  component: LoginPage,
});
