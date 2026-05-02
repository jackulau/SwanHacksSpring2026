import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { Mic, Upload, BookOpen, Flame, Clock, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [authLoading, user, navigate]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-zinc-400 text-sm mt-1">Welcome back, {user.email}</p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/capture"
            className="flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mic className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Record Lecture</p>
              <p className="text-sm text-zinc-500">Start a live recording</p>
            </div>
          </Link>

          <Link
            to="/capture/upload"
            className="flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Upload Audio</p>
              <p className="text-sm text-zinc-500">Upload a recording file</p>
            </div>
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Due for Review */}
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-warning" />
              <h3 className="text-sm font-medium text-zinc-400">Due for Review</h3>
            </div>
            <p className="text-3xl font-bold">0</p>
            <p className="text-xs text-zinc-500 mt-1">flashcards due today</p>
          </div>

          {/* Study Streak */}
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-error" />
              <h3 className="text-sm font-medium text-zinc-400">Study Streak</h3>
            </div>
            <p className="text-3xl font-bold">0</p>
            <p className="text-xs text-zinc-500 mt-1">days in a row</p>
          </div>

          {/* Courses */}
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="w-4 h-4 text-success" />
              <h3 className="text-sm font-medium text-zinc-400">Courses</h3>
            </div>
            <p className="text-3xl font-bold">0</p>
            <p className="text-xs text-zinc-500 mt-1">active courses</p>
          </div>
        </div>

        {/* Recent Lectures */}
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium text-zinc-400">Recent Lectures</h3>
          </div>
          <div className="text-center py-8">
            <p className="text-zinc-500 text-sm">No lectures yet.</p>
            <p className="text-zinc-600 text-xs mt-1">
              Record or upload your first lecture to get started.
            </p>
          </div>
        </div>

        {/* Course chips placeholder */}
        <div>
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Your Courses</h3>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1">
              No courses yet
            </span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
