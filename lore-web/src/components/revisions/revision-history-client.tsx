"use client";

import { FileDiff, FolderTree, Info, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type RevisionItem = {
  number: string;
  signature: string;
  metadata: string;
  state: string;
};

type RevisionList = {
  items?: RevisionItem[];
  signatureForward?: string;
  signatureBackward?: string;
  error?: string;
};

type RequestState = { tone: "idle" | "success" | "error"; message: string };

const inputClass = "h-9 rounded-md border bg-background px-3 text-sm";

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T & { error?: string }) : ({} as T & { error?: string });
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with HTTP ${response.status}`);
  }
  return payload;
}

export function RevisionHistoryClient({ repoId, branchId }: { repoId: string; branchId: string }) {
  const [revisions, setRevisions] = useState<RevisionItem[]>([]);
  const [selected, setSelected] = useState("");
  const [cursor, setCursor] = useState("");
  const [forward, setForward] = useState("");
  const [backward, setBackward] = useState("");
  const [panelTitle, setPanelTitle] = useState("Revision detail");
  const [panelBody, setPanelBody] = useState("Select a revision or load branch tip.");
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<RequestState>({ tone: "idle", message: "Revision actions are ready." });

  async function loadRevisions(mode: "tip" | "cursor" = "tip") {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (mode === "cursor" && cursor.trim()) {
        params.set("cursor", cursor.trim());
      } else {
        params.set("branchId", branchId);
      }
      const payload = await readJson<RevisionList>(
        await fetch(`/api/repositories/${repoId}/revisions?${params.toString()}`, { cache: "no-store" }),
      );
      const next = payload.items ?? [];
      setRevisions(next);
      setForward(payload.signatureForward ?? "");
      setBackward(payload.signatureBackward ?? "");
      setSelected(next[0]?.signature ?? "");
      setState({
        tone: "success",
        message: next.length ? `Loaded ${next.length} revisions.` : "No revisions returned.",
      });
    } catch (error) {
      setState({ tone: "error", message: error instanceof Error ? error.message : "Revision load failed." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadRevisions("tip"), 0);
    return () => window.clearTimeout(timeout);
    // Initial load only; subsequent loads are explicit actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPanel(view: "info" | "tree" | "diff") {
    if (!selected.trim()) {
      setState({ tone: "error", message: "Select a revision signature first." });
      return;
    }
    setLoading(true);
    try {
      const payload = await readJson<unknown>(
        await fetch(`/api/repositories/${repoId}/revisions/${selected}?view=${view}`, { cache: "no-store" }),
      );
      setPanelTitle(view === "info" ? "Revision info" : view === "tree" ? "Tree panel" : "Diff panel");
      setPanelBody(JSON.stringify(payload, null, 2));
      setState({ tone: "success", message: `Loaded ${view} data.` });
    } catch (error) {
      setState({ tone: "error", message: error instanceof Error ? error.message : `${view} request failed.` });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 rounded-lg border bg-card/95 p-4 shadow-sm lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <label className="flex flex-col gap-2 text-sm font-medium">
          Branch id
          <input aria-label="Revision branch id" className={inputClass} value={branchId} readOnly />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Forward cursor
          <input aria-label="Forward cursor" className={inputClass} value={cursor} onChange={(event) => setCursor(event.target.value)} placeholder={forward || "cursor signature"} />
        </label>
        <div className="flex gap-2">
          <Button type="button" onClick={() => void loadRevisions("tip")} disabled={loading}>
            {loading ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}
            Load tip
          </Button>
          <Button type="button" variant="outline" onClick={() => void loadRevisions("cursor")} disabled={loading}>
            Load cursor
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
        <table className="w-full min-w-[880px] table-fixed text-left text-sm">
          <thead className="bg-muted text-xs font-medium uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Revision</th>
              <th className="px-4 py-3">Signature</th>
              <th className="px-4 py-3">Metadata</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {revisions.length ? (
              revisions.map((revision) => (
                <tr key={revision.signature || revision.number} className={revision.signature === selected ? "bg-accent/35" : "hover:bg-muted/45"}>
                  <td className="px-4 py-3">{revision.number}</td>
                  <td className="truncate px-4 py-3 font-mono text-xs">{revision.signature}</td>
                  <td className="truncate px-4 py-3 font-mono text-xs">{revision.metadata}</td>
                  <td className="truncate px-4 py-3 font-mono text-xs">{revision.state}</td>
                  <td className="px-4 py-3">
                    <Button type="button" variant="secondary" size="sm" onClick={() => setSelected(revision.signature)}>
                      Select
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-muted-foreground">
                  No revisions returned for this branch.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border bg-card/95 p-4 shadow-sm">
          <h2 className="text-base font-semibold">Forward cursor</h2>
          <p className="mt-2 truncate font-mono text-xs text-muted-foreground">{forward || "none"}</p>
          <p className="mt-2 truncate font-mono text-xs text-muted-foreground">Back: {backward || "none"}</p>
        </section>
        <section className="rounded-lg border bg-card/95 p-4 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{panelTitle}</h2>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void loadPanel("info")} disabled={loading}>
                <Info aria-hidden="true" />
                Info
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadPanel("tree")} disabled={loading}>
                <FolderTree aria-hidden="true" />
                Tree panel
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadPanel("diff")} disabled={loading}>
                <FileDiff aria-hidden="true" />
                Diff panel
              </Button>
            </div>
          </div>
          <pre className="mt-3 max-h-80 overflow-auto rounded-md border bg-background p-3 text-xs text-muted-foreground">
            {panelBody}
          </pre>
        </section>
      </div>
    </div>
  );
}
