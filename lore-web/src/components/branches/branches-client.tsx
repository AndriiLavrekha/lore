"use client";

import Link from "next/link";
import {
  GitBranch,
  History,
  Loader2,
  RefreshCw,
  Shield,
  ShieldOff,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type BranchJson = {
  id: string;
  name: string;
  creator: string;
  category: string;
  latest: string;
  deleted: boolean;
  metadata: string;
};

type ApiList = { items?: BranchJson[]; error?: string };
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

function metadataPayloadBase64() {
  return btoa(JSON.stringify({ protect: false }));
}

export function BranchesClient({ repoId }: { repoId: string }) {
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [creator, setCreator] = useState("");
  const [branches, setBranches] = useState<BranchJson[]>([]);
  const [selected, setSelected] = useState<BranchJson | undefined>();
  const [branchName, setBranchName] = useState("");
  const [category, setCategory] = useState("feature");
  const [forkBranchId, setForkBranchId] = useState("");
  const [forkRevision, setForkRevision] = useState(ZERO_HASH);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [pushRevision, setPushRevision] = useState(ZERO_HASH);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<RequestState>({ tone: "idle", message: "Branch actions are ready." });

  const liveBranches = useMemo(
    () => branches.filter((branch) => includeDeleted || !branch.deleted),
    [branches, includeDeleted],
  );

  async function loadBranches() {
    const params = new URLSearchParams();
    if (includeDeleted) params.set("include_deleted", "true");
    if (creator.trim()) params.set("creator", creator.trim());
    const payload = await readJson<ApiList>(
      await fetch(`/api/repositories/${repoId}/branches?${params.toString()}`, { cache: "no-store" }),
    );
    const next = payload.items ?? [];
    setBranches(next);
    const nextSelected = next.find((branch) => branch.id === selected?.id) ?? next[0];
    setSelected(nextSelected);
    if (nextSelected) {
      setForkBranchId((current) => current || nextSelected.id);
      setForkRevision((current) => (current === ZERO_HASH ? nextSelected.latest || ZERO_HASH : current));
    }
    return next;
  }

  async function refresh() {
    setLoading(true);
    try {
      const next = await loadBranches();
      setState({
        tone: "success",
        message: next.length ? `Loaded ${next.length} branches.` : "Loaded an empty branch list.",
      });
    } catch (error) {
      setState({ tone: "error", message: error instanceof Error ? error.message : "Branch load failed." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
    // Initial load only; filters reload through explicit Query/Refresh actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createBranch() {
    if (!branchName.trim()) {
      setState({ tone: "error", message: "Branch name is required." });
      return;
    }
    if (!forkBranchId.trim()) {
      setState({ tone: "error", message: "Select or enter a fork branch id." });
      return;
    }
    setLoading(true);
    try {
      const created = await readJson<BranchJson>(
        await fetch(`/api/repositories/${repoId}/branches`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: branchName.trim(),
            category: category.trim(),
            stack: [{ branchId: forkBranchId.trim(), revisionSignature: forkRevision.trim() || ZERO_HASH }],
          }),
        }),
      );
      setBranches((current) => [created, ...current.filter((branch) => branch.id !== created.id)]);
      setSelected(created);
      setBranchName("");
      setDeleteConfirmation("");
      setState({ tone: "success", message: `Created branch ${created.name}.` });
    } catch (error) {
      setState({ tone: "error", message: error instanceof Error ? error.message : "Branch create failed." });
    } finally {
      setLoading(false);
    }
  }

  async function deleteBranch() {
    if (!selected) {
      setState({ tone: "error", message: "Select a branch before deleting." });
      return;
    }
    setLoading(true);
    try {
      const deleted = await readJson<BranchJson>(
        await fetch(`/api/repositories/${repoId}/branches/${selected.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branchName: selected.name, confirmation: deleteConfirmation }),
        }),
      );
      setBranches((current) => current.map((branch) => (branch.id === deleted.id ? deleted : branch)));
      setSelected(deleted);
      setDeleteConfirmation("");
      setState({ tone: "success", message: `Deleted branch ${deleted.name}.` });
    } catch (error) {
      setState({ tone: "error", message: error instanceof Error ? error.message : "Branch delete failed." });
    } finally {
      setLoading(false);
    }
  }

  async function pushBranch() {
    if (!selected) {
      setState({ tone: "error", message: "Select a branch before pushing." });
      return;
    }
    setLoading(true);
    try {
      await readJson<unknown>(
        await fetch(`/api/repositories/${repoId}/branches/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revisionSignature: pushRevision.trim(), force: false, fastForwardMerge: false }),
        }),
      );
      await loadBranches();
      setState({ tone: "success", message: `Pushed revision to ${selected.name}.` });
    } catch (error) {
      setState({ tone: "error", message: error instanceof Error ? error.message : "Branch push failed." });
    } finally {
      setLoading(false);
    }
  }

  async function toggleProtection(protect: boolean) {
    if (!selected) {
      setState({ tone: "error", message: "Select a branch before changing protection." });
      return;
    }
    setLoading(true);
    try {
      const result = await readJson<{ metadata: string }>(
        await fetch(`/api/repositories/${repoId}/branches/${selected.id}/protection`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            protect,
            currentMetadataHash: selected.metadata,
            metadataPayloadBase64: metadataPayloadBase64(),
          }),
        }),
      );
      setBranches((current) =>
        current.map((branch) => (branch.id === selected.id ? { ...branch, metadata: result.metadata } : branch)),
      );
      setSelected((current) => (current ? { ...current, metadata: result.metadata } : current));
      setState({ tone: "success", message: protect ? "Branch protected." : "Branch unprotected." });
    } catch (error) {
      setState({ tone: "error", message: error instanceof Error ? error.message : "Protection update failed." });
    } finally {
      setLoading(false);
    }
  }

  function selectBranch(branch: BranchJson) {
    setSelected(branch);
    setForkBranchId(branch.id);
    setForkRevision(branch.latest || ZERO_HASH);
    setPushRevision(branch.latest || ZERO_HASH);
    setDeleteConfirmation("");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 rounded-lg border bg-card/95 p-4 shadow-sm xl:grid-cols-[auto_1fr_1fr_1fr_auto] xl:items-end">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            aria-label="Include deleted branches"
            type="checkbox"
            className="size-4"
            checked={includeDeleted}
            onChange={(event) => setIncludeDeleted(event.target.checked)}
          />
          Include deleted
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Creator filter
          <input aria-label="Creator filter" className={inputClass} value={creator} onChange={(event) => setCreator(event.target.value)} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Branch name
          <input aria-label="Branch name" className={inputClass} value={branchName} onChange={(event) => setBranchName(event.target.value)} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Category
          <input aria-label="Branch category" className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)} />
        </label>
        <div className="flex gap-2">
          <Button type="button" onClick={createBranch} disabled={loading}>
            {loading ? <Loader2 aria-hidden="true" className="animate-spin" /> : <GitBranch aria-hidden="true" />}
            Create branch
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={refresh} disabled={loading} aria-label="Refresh branches">
            <RefreshCw aria-hidden="true" />
          </Button>
        </div>
        <label className="flex flex-col gap-2 text-sm font-medium xl:col-span-2">
          Fork branch id
          <input aria-label="Fork branch id" className={inputClass} value={forkBranchId} onChange={(event) => setForkBranchId(event.target.value)} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium xl:col-span-3">
          Fork revision signature
          <input aria-label="Fork revision signature" className={inputClass} value={forkRevision} onChange={(event) => setForkRevision(event.target.value)} />
        </label>
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
        <table className="w-full min-w-[980px] table-fixed text-left text-sm">
          <thead className="bg-muted text-xs font-medium uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Tip</th>
              <th className="px-4 py-3">Metadata</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {liveBranches.length ? (
              liveBranches.map((branch) => (
                <tr key={branch.id} className={branch.id === selected?.id ? "bg-accent/35" : "hover:bg-muted/45"}>
                  <td className="truncate px-4 py-3 font-medium">{branch.name}</td>
                  <td className="truncate px-4 py-3">{branch.category || "none"}</td>
                  <td className="truncate px-4 py-3 font-mono text-xs">{branch.latest}</td>
                  <td className="truncate px-4 py-3 font-mono text-xs">{branch.metadata}</td>
                  <td className="px-4 py-3">{branch.deleted ? "deleted" : "live"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" size="sm" onClick={() => selectBranch(branch)}>
                        Select
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/repositories/${repoId}/branches/${branch.id}/history`}>
                          <History aria-hidden="true" />
                          History
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-muted-foreground">
                  No branches are available for the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border bg-card/95 p-4 shadow-sm">
          <h2 className="text-base font-semibold">Delete confirmation</h2>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {selected ? `${selected.name} ${selected.id}` : "Select a branch first."}
          </p>
          <input
            aria-label="Branch delete confirmation"
            className={`${inputClass} mt-3 w-full`}
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
            placeholder={selected ? `${selected.name} ${selected.id}` : "branch-name branch-id"}
          />
          <Button className="mt-3 w-full" type="button" variant="destructive" onClick={deleteBranch} disabled={loading}>
            <Trash2 aria-hidden="true" />
            Delete branch
          </Button>
        </section>

        <section className="rounded-lg border bg-card/95 p-4 shadow-sm">
          <h2 className="text-base font-semibold">Push revision</h2>
          <input
            aria-label="Revision signature"
            className={`${inputClass} mt-3 w-full`}
            value={pushRevision}
            onChange={(event) => setPushRevision(event.target.value)}
          />
          <Button className="mt-3 w-full" type="button" onClick={pushBranch} disabled={loading}>
            <Upload aria-hidden="true" />
            Push revision
          </Button>
        </section>

        <section className="rounded-lg border bg-card/95 p-4 shadow-sm">
          <h2 className="text-base font-semibold">Protection</h2>
          <p className="mt-1 truncate text-sm text-muted-foreground">{selected?.metadata ?? "Select a branch first."}</p>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="outline" onClick={() => void toggleProtection(true)} disabled={loading}>
              <Shield aria-hidden="true" />
              Protect branch
            </Button>
            <Button type="button" variant="outline" onClick={() => void toggleProtection(false)} disabled={loading}>
              <ShieldOff aria-hidden="true" />
              Unprotect branch
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
