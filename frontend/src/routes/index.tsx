import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { pb } from "../lib/pocketbase";
import { useAuth } from "../lib/auth";
import type { Item } from "../lib/types";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [authLoading, user, navigate]);

  async function fetchItems() {
    try {
      const records = await pb.collection("items").getFullList<Item>();
      setItems(records);
      setError("");
    } catch {
      setError(
        "Cannot connect to PocketBase. Make sure it's running on port 8090.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) fetchItems();
  }, [user]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await pb.collection("items").create({ name, description });
    setName("");
    setDescription("");
    fetchItems();
  }

  async function handleDelete(id: string) {
    await pb.collection("items").delete(id);
    fetchItems();
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold">HackStack</h1>
            <p className="text-zinc-400">Signed in as {user.email}</p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate({ to: "/login" });
            }}
            className="text-zinc-400 hover:text-white border border-zinc-700 px-4 py-2 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6 text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleAdd} className="flex gap-3 mb-8">
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-zinc-500"
          />
          <input
            type="text"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-zinc-500"
          />
          <button
            type="submit"
            className="bg-white text-black font-medium px-6 py-2 rounded-lg hover:bg-zinc-200 transition-colors"
          >
            Add
          </button>
        </form>

        {loading ? (
          <p className="text-zinc-500">Loading...</p>
        ) : items.length === 0 ? (
          <p className="text-zinc-500">No items yet. Add one above.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between bg-zinc-800/50 border border-zinc-800 rounded-lg p-4"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  {item.description && (
                    <p className="text-zinc-400 text-sm">{item.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-zinc-500 hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
