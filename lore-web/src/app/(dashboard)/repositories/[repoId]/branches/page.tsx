import { PageHeader } from "@/components/page-header";
import { PlaceholderTable } from "@/components/placeholder-table";
import { Button } from "@/components/ui/button";

type BranchesPageProps = {
  params: Promise<{
    repoId: string;
  }>;
};

export default async function BranchesPage({ params }: BranchesPageProps) {
  const { repoId } = await params;

  return (
    <>
      <PageHeader
        title="Branches"
        description={`Branch management controls for repository ${repoId}. Every branch operation is repo-scoped through binary gRPC metadata.`}
        label="Repo scoped"
      />

      <div className="mb-4 grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input aria-label="Include deleted branches" type="checkbox" className="size-4" />
          Include deleted branches
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Creator filter
          <input aria-label="Creator filter" className="h-9 rounded-md border bg-background px-3" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Branch name
          <input aria-label="Branch name" className="h-9 rounded-md border bg-background px-3" />
        </label>
        <Button type="button">Create branch</Button>
      </div>

      <PlaceholderTable
        columns={["Branch", "Category", "Tip", "Protection"]}
        rows={[
          ["main", "trunk", "unavailable", "unknown"],
          ["release", "release", "unavailable", "unknown"],
        ]}
      />

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold">Delete confirmation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Type the exact branch name and id separated by a space.
          </p>
          <input
            aria-label="Branch delete confirmation"
            className="mt-3 h-9 w-full rounded-md border bg-background px-3 text-sm"
            placeholder="main ffeeddccbbaa99887766554433221100"
          />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold">Push revision</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Push a known 32-byte revision signature to a branch.
          </p>
          <input
            aria-label="Revision signature"
            className="mt-3 h-9 w-full rounded-md border bg-background px-3 text-sm"
            placeholder="64 hex characters"
          />
        </div>
        <div className="rounded-lg border bg-card p-4 md:col-span-2">
          <h2 className="text-base font-semibold">Protection</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Toggle branch protection through metadata CAS after refreshing the branch metadata.
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="outline">
              Protect branch
            </Button>
            <Button type="button" variant="outline">
              Unprotect branch
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
