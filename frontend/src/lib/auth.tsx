import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { pb } from "./pocketbase";
import type { RecordModel } from "pocketbase";

interface AuthContext {
  user: RecordModel | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<RecordModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(pb.authStore.record);
    setLoading(false);

    const unsub = pb.authStore.onChange((_token, record) => {
      setUser(record);
    });
    return unsub;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await pb.collection("users").authWithPassword(email, password);
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    await pb
      .collection("users")
      .create({ email, password, passwordConfirm: password });
    await pb.collection("users").authWithPassword(email, password);
  }, []);

  const logout = useCallback(() => {
    pb.authStore.clear();
  }, []);

  return (
    <AuthContext value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
