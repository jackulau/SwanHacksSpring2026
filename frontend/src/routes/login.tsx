import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { ArrowLeft } from "lucide-react";
import { ConvergeLogo } from "../components/layout/ConvergeLogo";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user, login, signup, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/" });
  }, [authLoading, user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isSignup) {
        await signup(email, password);
      } else {
        await login(email, password);
      }
      navigate({ to: "/" });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Authentication failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-white flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 vibe-aurora flex-col justify-between p-12 border-r border-[var(--color-border)]">
        <div className="relative z-10 flex items-center gap-2 text-white">
          <ConvergeLogo className="w-7 h-7" />
          <span className="text-xl font-bold tracking-tight">Converge</span>
        </div>
        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white leading-tight mb-4 tracking-tight">
            Turn any lecture into study material
          </h2>
          <p className="text-[var(--color-text-muted)] text-lg leading-relaxed">
            Record, transcribe, and generate flashcards, notes, and quizzes —
            all powered by AI. Built accessibility-first.
          </p>
        </div>
        <div className="relative z-10 flex gap-6 text-sm text-[var(--color-text-muted)]">
          <div>
            <p className="text-2xl font-bold text-[var(--color-primary-strong)]">10+</p>
            <p>Accessibility features</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--color-primary-strong)]">4</p>
            <p>Quiz types</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--color-primary-strong)]">SM-2</p>
            <p>Spaced repetition</p>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-text-subtle)] hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>

          <div className="flex items-center gap-2 mb-2 lg:hidden text-white">
            <ConvergeLogo className="w-6 h-6" />
            <span className="text-lg font-bold tracking-tight">Converge</span>
          </div>

          <h1 className="text-2xl font-bold mb-1 tracking-tight">
            {isSignup ? "Create account" : "Welcome back"}
          </h1>
          <p className="text-[var(--color-text-muted)] text-sm mb-8">
            {isSignup
              ? "Sign up to start studying smarter"
              : "Sign in to your account"}
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-3 mb-5 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                Email
              </label>
              <input
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                Password
              </label>
              <input
                type="password"
                placeholder="Min 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black font-semibold py-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? "..."
                : isSignup
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-[var(--color-text-muted)] text-sm">
            {isSignup ? "Already have an account?" : "No account?"}{" "}
            <button
              onClick={() => {
                setIsSignup(!isSignup);
                setError("");
              }}
              className="text-[var(--color-primary-strong)] hover:text-[var(--color-primary-hover)] font-medium"
            >
              {isSignup ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
