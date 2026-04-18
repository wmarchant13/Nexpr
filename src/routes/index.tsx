import { createFileRoute, redirect } from "@tanstack/react-router";
import LoginPage from "../components/LoginPage";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && localStorage.getItem("accessToken")) {
      throw redirect({ to: "/dashboard", replace: true });
    }
  },
  component: LoginPage,
});
