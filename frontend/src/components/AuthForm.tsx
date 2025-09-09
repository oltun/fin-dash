import { useState } from "react";
import { loginUser, registerUser } from "../lib/api";

export default function AuthForm({
  onSuccess,
}: { onSuccess: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") {
        await registerUser(email, password);
        await loginUser(email, password);
      } else {
        await loginUser(email, password);
      }
      onSuccess();
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 rounded-xl border bg-white">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">
          {mode === "login" ? "Log in" : "Create account"}
        </h2>
        <button
          type="button"
          className="text-sm text-blue-600 hover:underline"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account? Register" : "Have an account? Log in"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            required
            className="mt-1 w-full rounded-md border px-3 py-2 outline-none focus:ring"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            required
            className="mt-1 w-full rounded-md border px-3 py-2 outline-none focus:ring"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="text-sm text-red-600">{error}</div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-black text-white py-2 font-medium disabled:opacity-60"
        >
          {busy ? "Please wait…" : (mode === "login" ? "Log in" : "Register")}
        </button>
      </form>
    </div>
  );
}
