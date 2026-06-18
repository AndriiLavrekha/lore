"use client";

import Link from "next/link";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { CheckCircle2, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { RepositoryJson } from "@/server/grpc/repositories";

type ApiList = { items?: RepositoryJson[]; error?: string };
type RequestState = { tone: "idle" | "success" | "error"; message: string };

const inputClass = "h-9 rounded-md border bg-background px-3 text-sm";

const columns: ColumnDef<RepositoryJson>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "id",
    header: "Repository id",
  },
  {
    accessorKey: "defaultBranchName",
    header: "Default branch",
  },
  {
    accessorKey: "metadata",
    header: "Metadata",
  },
];

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T & { error?: string }) : ({} as T & { error?: string });
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with HTTP ${response.status}`);
  }
  return payload;
}

export function RepositoriesClient({ initialItems }: { initialItems: RepositoryJson[] }) {
  const [filter, setFilter] = useState("");
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<RepositoryJson | undefined>(initialItems[0]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultBranchName, setDefaultBranchName] = useState("main");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<RequestState>({
    tone: "idle",
    message: "Repository actions are ready.",
  });

  const refresh = async () => {
    setLoading(true);
    try {
      const payload = await readJson<ApiList>(await fetch("/api/repositories", { cache: "no-store" }));
      const nextItems = payload.items ?? [];
      setItems(nextItems);
      setSelected((current) => nextItems.find((item) => item.id === current?.id) ?? nextItems[0]);
      setState({
        tone: "success",
        message: nextItems.length ? `Loaded ${nextItems.length} repositories.` : "Loaded an empty repository list.",
      });
    } catch (error) {
      setState({ tone: "error", message: error instanceof Error ? error.message : "Repository load failed." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const data = useMemo(() => items, [items]);
  // TanStack Table intentionally returns function-bearing table instances.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter: filter,
    },
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  async function createRepository() {
    if (!name.trim()) {
      setState({ tone: "error", message: "Repository name is required." });
      return;
    }
    setLoading(true);
    try {
      const created = await readJson<RepositoryJson>(
        await fetch("/api/repositories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            defaultBranchName: defaultBranchName.trim() || "main",
          }),
        }),
      );
      setItems((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setSelected(created);
      setName("");
      setDescription("");
      setDefaultBranchName("main");
      setConfirmation("");
      setState({ tone: "success", message: `Created ${created.name}.` });
    } catch (error) {
      setState({ tone: "error", message: error instanceof Error ? error.message : "Repository create failed." });
    } finally {
      setLoading(false);
    }
  }

  async function deleteRepository() {
    if (!selected) {
      setState({ tone: "error", message: "Select a repository before deleting." });
      return;
    }
    setLoading(true);
    try {
      await readJson<RepositoryJson>(
        await fetch(`/api/repositories/${selected.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: selected.name, confirmation }),
        }),
      );
      setItems((current) => current.filter((item) => item.id !== selected.id));
      setSelected(undefined);
      setConfirmation("");
      setState({ tone: "success", message: `Deleted ${selected.name}.` });
    } catch (error) {
      setState({ tone: "error", message: error instanceof Error ? error.message : "Repository delete failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 rounded-lg border bg-card/95 p-4 shadow-sm lg:grid-cols-[1fr_1fr_11rem_auto] lg:items-end">
        <label className="flex flex-col gap-2 text-sm font-medium">
          Filter repositories
          <input
            aria-label="Filter repositories"
            className={inputClass}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          New repository name
          <input
            aria-label="New repository name"
            className={inputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="release-vault"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Default branch
          <input
            aria-label="Default branch name"
            className={inputClass}
            value={defaultBranchName}
            onChange={(event) => setDefaultBranchName(event.target.value)}
          />
        </label>
        <div className="flex gap-2">
          <Button type="button" onClick={createRepository} disabled={loading}>
            {loading ? <Loader2 aria-hidden="true" className="animate-spin" /> : <CheckCircle2 aria-hidden="true" />}
            Create
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={refresh} disabled={loading} aria-label="Refresh repositories">
            <RefreshCw aria-hidden="true" />
          </Button>
        </div>
        <label className="lg:col-span-4 flex flex-col gap-2 text-sm font-medium">
          Description
          <input
            aria-label="Repository description"
            className={inputClass}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional repository description"
          />
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
        <table className="w-full min-w-[900px] table-fixed text-left text-sm">
          <thead className="bg-muted text-xs font-medium uppercase text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} scope="col" className="px-4 py-3">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3">
                  Actions
                </th>
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={row.original.id === selected?.id ? "bg-accent/35" : "hover:bg-muted/45"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="truncate px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/repositories/${row.original.id}/branches`}>Open</Link>
                      </Button>
                      <Button type="button" variant="secondary" size="sm" onClick={() => setSelected(row.original)}>
                        Select
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={columns.length + 1}>
                  No repositories match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border bg-card/95 p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">Delete confirmation</h2>
          <p className="text-sm text-muted-foreground">
            {selected ? `${selected.name} ${selected.id}` : "Select a repository row first."}
          </p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            aria-label="Delete confirmation"
            className={inputClass}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={selected ? `${selected.name} ${selected.id}` : "repository-name repository-id"}
          />
          <Button type="button" variant="destructive" onClick={deleteRepository} disabled={loading}>
            <Trash2 aria-hidden="true" />
            Delete selected
          </Button>
        </div>
      </div>
    </div>
  );
}
