/**
 * App Layout Route
 * 
 * Parent route for all authenticated pages.
 * Provides the consistent app shell with navigation.
 */

import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import AppLayout from "../components/AppLayout";

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    // Redirect to login if not authenticated
    if (typeof window !== "undefined" && !localStorage.getItem("accessToken")) {
      throw redirect({ to: "/", replace: true });
    }
  },
  component: AppLayout,
});
