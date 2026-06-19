"use client";

import { KeyRound, Loader2, Lock, RefreshCw, ShieldAlert, Unlock } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type LockJson = {
  branch: string;
  hash: string;
  description: string;
  owner: string;
  lockedAt: string | null;
};

type ApiList = { items?: LockJson[]; error?: string };
type RequestState = { tone: "idle" | "success" | "error"; message: string };

const ZERO_HASH = "0".repeat(64);
const inputClass = "h-9 rounded-md border bg-background px-3 text-sm";

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T & { error?: string }) : ({} as T & { error?: string });
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with HTTP ${response.status}`);
  }
  return payload;
}

export function LocksClient({ repoId }: { repoId: string }) {
  const [branch, setBranch] = useState("");
  const [owner, setOwner] = useState("");
  const [description, setDescription] = useState("");
  const [hash, setHash] = useState(ZERO_HASH);
  const [locks, setLocks] = useState<LockJson[]>([]);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<RequestState>({ tone: "idle", message: "Lock actions are ready." });

  async function loadLocks() {
    const params = new URLSearchParams();
    if (branch.trim()) params.set("branch", branch.trim());
    if (owner.trim()) params.set("owner", owner.trim());
    if (description.trim() && (branch.trim() || owner.trim())) params.set("description", description.trim());
    const payload = await readJson<ApiList>(
      await fetch(`/api/repositories/${repoId}/locks?${params.toString()}`, { cache: "no-store" }),
    );
    const next = payload.items ?? [];
    setLocks(next);
    return next;
  }

  async function queryLocks() {
    setLoading(true);
    try {
      const next = await loadLocks();
      setState({
        tone: "success",
        message: next.length ? `Loaded ${next.length} locks.` : "No locks matched the current filters.",
      });
    } catch (error) {
      setState({ tone: "error", message: error instanceof Error ? error.message : "Lock query failed." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void queryLocks(), 0);
    return () => window.clearTimeout(timeout);
    // Initial load only; filters reload through explicit Query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function body() {
    return {
      owner: owner.trim() || undefined,
      resources: [{ branch: branch.trim(), hash: hash.trim(), description: description.trim() }],
    };
  }

  function validateLockInput() {
    if (!branch.trim()) {
      setState({ tone: "error", message: "Branch id is required for lock actions." });
      return false;
    }
    if (!description.trim()) {
      setState({ tone: "error", message: "Lock description is required." });
      return false;
    }
    return true;
  }

  async function mutateLock(mode: "acquire" | "admin" | "release") {
    if (!validateLockInput()) return;
    setLoading(true);
    try {
      const url = mode === "admin" ? `/api/repositories/${repoId}/locks?admin=true` : `/api/repositories/${repoId}/locks`;
      await readJson<unknown>(
        await fetch(url, {
          method: mode === "release" ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body()),
        }),
      );
      await loadLocks();
      setState({
        tone: "success",
        message: mode === "release" ? "Lock release requested." : mode === "admin" ? "Admin lock requested." : "Lock acquire requested.",
      });
    } catch (error) {
      setState({ tone: "error", message: error instanceof Error ? error.message : "Lock action failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 rounded-lg border bg-card/95 p-4 shadow-sm xl:grid-cols-[1fr_1fr_1fr_auto] xl:items-end">
        <label className="flex flex-col gap-2 text-sm font-medium">
          Branch filter
          <input aria-label="Branch filter" className={inputClass} value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="branch id" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Owner filter
          <input aria-label="Owner filter" className={inputClass} value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="owner" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Path filter
          <input aria-label="Path filter" className={inputClass} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="/path" />
        </label>
        <Button type="button" variant="outline" onClick={queryLocks} disabled={loading}>
          <RefreshCw aria-hidden="true" />
          Query
        </Button>
        <label className="flex flex-col gap-2 text-sm font-medium xl:col-span-3">
          Resource hash
          <input aria-label="Lock resource hash" className={inputClass} value={hash} onChange={(event) => setHash(event.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void mutateLock("acquire")} disabled={loading}>
            {loading ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Lock aria-hidden="true" />}
            Acquire lock
          </Button>
          <Button type="button" variant="outline" onClick={() => void mutateLock("admin")} disabled={loading}>
            <ShieldAlert aria-hidden="true" />
            Admin lock
          </Button>
          <Button type="button" variant="outline" onClick={() => void mutateLock("release")} disabled={loading}>
            <Unlock aria-hidden="true" />
            Release lock
          </Button>
        </div>
      </div>

      <div
        role="status"
        className={`rounded-md border px-3 py-2 text-sm ${
          state.tone === "error" ? "border-destructive/40 text-destructive" : "text-muted-foreground"
        }`}
      >
        {state.message}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card/95 shadow-sm">
        <table className="w-full min-w-[860px] table-fixed text-left text-sm">
          <thead className="bg-muted text-xs font-medium uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Resource</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Hash</th>
              <th className="px-4 py-3">Locked at</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {locks.length ? (
              locks.map((lock) => (
                <tr key={`${lock.branch}:${lock.hash}:${lock.description}`} className="hover:bg-muted/45">
                  <td className="truncate px-4 py-3 font-medium">{lock.description}</td>
                  <td className="truncate px-4 py-3">{lock.owner || "unknown"}</td>
                  <td className="truncate px-4 py-3 font-mono text-xs">{lock.branch}</td>
                  <td className="truncate px-4 py-3 font-mono text-xs">{lock.hash}</td>
                  <td className="truncate px-4 py-3">{lock.lockedAt ?? "unknown"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-muted-foreground">
                  <KeyRound aria-hidden="true" className="mr-2 inline size-4" />
                  No locks returned.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
