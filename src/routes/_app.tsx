

import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { getViewerSession } from "../api/auth";
import AppLayout from "../components/AppLayout";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const session = await getViewerSession();
    if (!session.authenticated) {
      throw redirect({ to: "/", replace: true });
    }
  },
  component: AppLayout,
});
