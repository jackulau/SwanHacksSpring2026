import type { CanvasCourse, CanvasAssignment, CanvasConfig } from "./types";

export class CanvasClient {
  private baseUrl: string;
  private token: string;

  constructor(config: CanvasConfig) {
    this.baseUrl = config.base_url.replace(/\/+$/, "");
    this.token = config.api_token;
  }

  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api/v1${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Canvas API ${res.status}: ${text}`);
    }
    return res.json();
  }

  async testConnection(): Promise<{ name: string; id: number }> {
    return this.request("/users/self/profile");
  }

  async getCourses(): Promise<CanvasCourse[]> {
    return this.request(
      "/courses?enrollment_state=active&per_page=50&include[]=term",
    );
  }

  async getAssignments(courseId: number): Promise<CanvasAssignment[]> {
    return this.request(
      `/courses/${courseId}/assignments?per_page=100&order_by=due_at&include[]=submission`,
    );
  }

  async getAllAssignments(courseIds: number[]): Promise<CanvasAssignment[]> {
    const results = await Promise.all(
      courseIds.map((id) => this.getAssignments(id).catch(() => [])),
    );
    return results.flat();
  }
}

const CANVAS_STORAGE_KEY = "hackstack_canvas_config";

export function getCanvasConfig(): CanvasConfig | null {
  const raw = localStorage.getItem(CANVAS_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCanvasConfig(config: CanvasConfig) {
  localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(config));
}

export function clearCanvasConfig() {
  localStorage.removeItem(CANVAS_STORAGE_KEY);
}
