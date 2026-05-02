import { useState, useCallback, useEffect } from "react";
import {
  CanvasClient,
  getCanvasConfig,
  saveCanvasConfig,
  clearCanvasConfig,
} from "../lib/canvas";
import { pb } from "../lib/pocketbase";
import type {
  CanvasConfig,
  CanvasCourse,
  CanvasAssignment,
  Assignment,
  Course,
} from "../lib/types";

interface CanvasSyncState {
  connected: boolean;
  syncing: boolean;
  lastSync: string | null;
  error: string | null;
  canvasUser: string | null;
}

export function useCanvasSync(userId: string) {
  const [state, setState] = useState<CanvasSyncState>({
    connected: false,
    syncing: false,
    lastSync: localStorage.getItem("hackstack_canvas_last_sync"),
    error: null,
    canvasUser: localStorage.getItem("hackstack_canvas_user"),
  });

  useEffect(() => {
    const config = getCanvasConfig();
    if (config) {
      setState((s) => ({ ...s, connected: true }));
    }
  }, []);

  const connect = useCallback(
    async (baseUrl: string, apiToken: string) => {
      setState((s) => ({ ...s, syncing: true, error: null }));
      try {
        const config: CanvasConfig = {
          base_url: baseUrl,
          api_token: apiToken,
        };
        const client = new CanvasClient(config);
        const profile = await client.testConnection();
        saveCanvasConfig(config);
        localStorage.setItem("hackstack_canvas_user", profile.name);
        setState((s) => ({
          ...s,
          connected: true,
          syncing: false,
          canvasUser: profile.name,
        }));
        await syncAll(userId, client);
      } catch (err) {
        setState((s) => ({
          ...s,
          syncing: false,
          error:
            err instanceof Error ? err.message : "Failed to connect to Canvas",
        }));
      }
    },
    [userId],
  );

  const disconnect = useCallback(() => {
    clearCanvasConfig();
    localStorage.removeItem("hackstack_canvas_last_sync");
    localStorage.removeItem("hackstack_canvas_user");
    setState({
      connected: false,
      syncing: false,
      lastSync: null,
      error: null,
      canvasUser: null,
    });
  }, []);

  const sync = useCallback(async () => {
    const config = getCanvasConfig();
    if (!config) return;
    setState((s) => ({ ...s, syncing: true, error: null }));
    try {
      const client = new CanvasClient(config);
      await syncAll(userId, client);
      const now = new Date().toISOString();
      localStorage.setItem("hackstack_canvas_last_sync", now);
      setState((s) => ({ ...s, syncing: false, lastSync: now }));
    } catch (err) {
      setState((s) => ({
        ...s,
        syncing: false,
        error: err instanceof Error ? err.message : "Sync failed",
      }));
    }
  }, [userId]);

  return { ...state, connect, disconnect, sync };
}

async function syncAll(userId: string, client: CanvasClient) {
  const canvasCourses = await client.getCourses();

  const existingCourses = await pb
    .collection("courses")
    .getFullList<Course>({ filter: `user = "${userId}"` })
    .catch(() => [] as Course[]);

  const courseMap = new Map<number, string>();

  for (const cc of canvasCourses) {
    const existing = existingCourses.find(
      (c) => c.code === cc.course_code && c.name === cc.name,
    );
    if (existing) {
      courseMap.set(cc.id, existing.id);
    } else {
      const colors = [
        "#6366f1",
        "#ec4899",
        "#14b8a6",
        "#f59e0b",
        "#ef4444",
        "#8b5cf6",
        "#06b6d4",
      ];
      const created = await pb.collection("courses").create({
        user: userId,
        name: cc.name,
        code: cc.course_code,
        color: colors[courseMap.size % colors.length],
        semester: "",
      });
      courseMap.set(cc.id, created.id);
    }
  }

  const canvasAssignments = await client.getAllAssignments(
    canvasCourses.map((c) => c.id),
  );

  const existingAssignments = await pb
    .collection("assignments")
    .getFullList<Assignment>({ filter: `user = "${userId}"` })
    .catch(() => [] as Assignment[]);

  const existingByCanvasId = new Map(
    existingAssignments.map((a) => [a.canvas_id, a]),
  );

  for (const ca of canvasAssignments) {
    const courseId = courseMap.get(ca.course_id);
    if (!courseId) continue;

    const status = getAssignmentStatus(ca);
    const data = {
      user: userId,
      course: courseId,
      canvas_id: ca.id,
      title: ca.name,
      description: ca.description || "",
      due_at: ca.due_at || "",
      points_possible: ca.points_possible || 0,
      status,
      canvas_url: ca.html_url,
      submission_types: JSON.stringify(ca.submission_types),
    };

    const existing = existingByCanvasId.get(ca.id);
    if (existing) {
      await pb.collection("assignments").update(existing.id, data);
    } else {
      await pb.collection("assignments").create(data);
    }
  }
}

function getAssignmentStatus(
  ca: CanvasAssignment,
): Assignment["status"] {
  if (ca.has_submitted_submissions) return "submitted";
  if (ca.due_at && new Date(ca.due_at) < new Date()) return "missing";
  return "upcoming";
}
