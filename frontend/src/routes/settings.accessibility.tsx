import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "../lib/auth";
import { SettingsShell } from "./settings";

export const Route = createFileRoute("/settings/accessibility")({
  component: SettingsAccessibilityPage,
});

function SettingsAccessibilityPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) return null;

  return <SettingsShell userId={user.id} initialSection="accessibility" />;
}
