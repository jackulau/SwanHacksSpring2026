import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { ConvergeLogo } from "../components/layout/ConvergeLogo";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

// Permissive but RFC-aligned check — validates the basic local@domain.tld shape.
// Server still authoritatively validates; this exists to surface format errors
// before the request hits the backend.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginPage() {
  const { user, login, signup, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/" });
  }, [authLoading, user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Manual focus-on-first-invalid (HTML validation also runs).
    if (!email) {
      emailRef.current?.focus();
      setError("Enter your email address.");
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      emailRef.current?.focus();
      setError("Enter a valid email address.");
      return;
    }
    if (!password || password.length < 8) {
      passwordRef.current?.focus();
      setError("Password must be at least 8 characters.");
      return;
    }

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
      // Focus the email field on auth failure so the user can correct.
      emailRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex items-center justify-center px-4 py-16">
      <main className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Link
            to="/"
            aria-label="Converge home"
            className="flex items-center gap-2 text-[var(--color-primary)]"
          >
            <ConvergeLogo className="w-7 h-7" />
            <span className="text-lg font-semibold tracking-tight font-brand">
              Converge
            </span>
          </Link>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg shadow-black/8 p-8">
          <h1 className="text-xl font-semibold tracking-tight">
            {isSignup ? "Create your account" : "Sign in"}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-2 mb-8">
            {isSignup
              ? "Start studying smarter in under a minute."
              : "Welcome back to Converge."}
          </p>

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-6 text-red-700 text-sm"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-[var(--color-text-muted)] mb-2"
              >
                Email
              </label>
              <input
                id="email"
                ref={emailRef}
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                aria-invalid={!!error}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-[var(--color-text-muted)] mb-2"
              >
                Password
              </label>
              <input
                id="password"
                ref={passwordRef}
                name="password"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                minLength={8}
                aria-invalid={!!error}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold text-sm py-2 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting
                ? isSignup
                  ? "Creating account…"
                  : "Signing in…"
                : isSignup
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <div
            className="flex items-center gap-3 my-6"
            aria-hidden="true"
          >
            <div className="h-px flex-1 bg-[var(--color-border)]" />
            <span className="text-xs uppercase tracking-wider text-[var(--color-text-subtle)]">
              or
            </span>
            <div className="h-px flex-1 bg-[var(--color-border)]" />
          </div>

          <p className="text-center text-sm text-[var(--color-text-muted)]">
            {isSignup ? "Already have an account?" : "New to Converge?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setError("");
              }}
              className="text-[var(--color-primary-strong)] hover:text-[var(--color-primary-hover)] font-medium underline-offset-2 hover:underline"
            >
              {isSignup ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-[var(--color-text-subtle)] mt-6">
          By continuing, you agree to our Terms and Privacy Policy.
        </p>
      </main>
    </div>
  );
}
