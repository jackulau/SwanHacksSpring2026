import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold mb-2">HackStack</h1>
        <p className="text-zinc-400 mb-8">
          {isSignup ? "Create an account" : "Sign in to continue"}
        </p>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 mb-4 text-red-200 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 focus:outline-none focus:border-zinc-500"
          />
          <input
            type="password"
            placeholder="Password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 focus:outline-none focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-white text-black font-medium py-3 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {submitting ? "..." : isSignup ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-zinc-500 text-sm">
          {isSignup ? "Already have an account?" : "No account?"}{" "}
          <button
            onClick={() => {
              setIsSignup(!isSignup);
              setError("");
            }}
            className="text-zinc-300 hover:text-white"
          >
            {isSignup ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}
