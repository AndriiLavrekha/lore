"use client";

import Link from "next/link";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { RepositoryJson } from "@/server/grpc/repositories";

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

export function RepositoriesClient({ initialItems }: { initialItems: RepositoryJson[] }) {
  const [filter, setFilter] = useState("");
  const [items] = useState(initialItems);
  const [deleteName, setDeleteName] = useState(initialItems[0]?.name ?? "sample");
  const [deleteId, setDeleteId] = useState(
    initialItems[0]?.id ?? "00112233445566778899aabbccddeeff",
  );
  const [confirmation, setConfirmation] = useState("");
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-end">
        <label className="flex flex-1 flex-col gap-2 text-sm font-medium">
          Filter repositories
          <input
            className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>
        <label className="flex flex-1 flex-col gap-2 text-sm font-medium">
          New repository name
          <input className="h-9 rounded-md border bg-background px-3 text-sm" placeholder="demo" />
        </label>
        <Button type="button">Create repository</Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full table-fixed text-left text-sm">
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
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="truncate px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/repositories/${row.original.id}/branches`}>Open</Link>
                    </Button>
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

      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-base font-semibold">Delete confirmation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Type the exact repository name and id separated by a space before deletion.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            aria-label="Delete repository name"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={deleteName}
            onChange={(event) => setDeleteName(event.target.value)}
          />
          <input
            aria-label="Delete repository id"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={deleteId}
            onChange={(event) => setDeleteId(event.target.value)}
          />
          <input
            aria-label="Delete confirmation"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={`${deleteName} ${deleteId}`}
          />
        </div>
      </div>
    </div>
  );
}
