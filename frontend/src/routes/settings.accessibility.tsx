import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/accessibility")({
  beforeLoad: () => {
    throw redirect({ to: "/settings" });
  },
});
