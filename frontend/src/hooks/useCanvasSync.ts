import { useState, useCallback, useEffect } from "react";
import { pb } from "../lib/pocketbase";
import type {
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

interface CanvasImportPayload {
  base_url: string;
  user: string;
  courses: CanvasCourse[];
  assignments: CanvasAssignment[];
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
    if (localStorage.getItem("hackstack_canvas_user")) {
      setState((s) => ({ ...s, connected: true }));
    }
  }, []);

  const importData = useCallback(
    async (jsonStr: string) => {
      setState((s) => ({ ...s, syncing: true, error: null }));
      try {
        let data: CanvasImportPayload;
        try {
          data = JSON.parse(jsonStr);
        } catch {
          throw new Error(
            "Invalid data. Make sure you copied the entire output from the Canvas console.",
          );
        }

        if (!Array.isArray(data.courses) || !Array.isArray(data.assignments)) {
          throw new Error(
            "Invalid format. Run the script again on Canvas and copy the full output.",
          );
        }

        await syncFromPayload(userId, data);

        const now = new Date().toISOString();
        const userName = data.user || data.base_url;
        localStorage.setItem("hackstack_canvas_last_sync", now);
        localStorage.setItem("hackstack_canvas_user", userName);

        setState((s) => ({
          ...s,
          connected: true,
          syncing: false,
          canvasUser: userName,
          lastSync: now,
        }));
      } catch (err) {
        setState((s) => ({
          ...s,
          syncing: false,
          error: err instanceof Error ? err.message : "Import failed",
        }));
      }
    },
    [userId],
  );

  const disconnect = useCallback(() => {
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

  return { ...state, importData, disconnect };
}

async function syncFromPayload(
  userId: string,
  data: CanvasImportPayload,
) {
  const existingCourses = await pb
    .collection("courses")
    .getFullList<Course>({ filter: `user = "${userId}"` })
    .catch(() => [] as Course[]);

  const courseMap = new Map<number, string>();
  const colors = [
    "#6366f1",
    "#ec4899",
    "#14b8a6",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
  ];

  for (const cc of data.courses) {
    const existing = existingCourses.find(
      (c) => c.code === cc.course_code && c.name === cc.name,
    );
    if (existing) {
      courseMap.set(cc.id, existing.id);
    } else {
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

  const existingAssignments = await pb
    .collection("assignments")
    .getFullList<Assignment>({ filter: `user = "${userId}"` })
    .catch(() => [] as Assignment[]);

  const existingByCanvasId = new Map(
    existingAssignments.map((a) => [a.canvas_id, a]),
  );

  for (const ca of data.assignments) {
    const courseId = courseMap.get(ca.course_id);
    if (!courseId) continue;

    const status = getAssignmentStatus(ca);
    const assignmentData = {
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
      await pb.collection("assignments").update(existing.id, assignmentData);
    } else {
      await pb.collection("assignments").create(assignmentData);
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
