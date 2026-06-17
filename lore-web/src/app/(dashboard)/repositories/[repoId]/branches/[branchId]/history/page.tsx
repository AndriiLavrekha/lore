import { PageHeader } from "@/components/page-header";
import { PlaceholderTable } from "@/components/placeholder-table";

type HistoryPageProps = {
  params: Promise<{
    repoId: string;
    branchId: string;
  }>;
};

export default async function HistoryPage({ params }: HistoryPageProps) {
  const { repoId, branchId } = await params;

  return (
    <>
      <PageHeader
        title="Revision history"
        description={`Newest-to-oldest revision history for branch ${branchId} in repository ${repoId}. Tree and diff streams are capped server-side.`}
        label="Cursor paged"
      />

      <PlaceholderTable
        columns={["Revision", "Author", "Created", "Summary"]}
        rows={[
          ["tip", "unavailable", "unavailable", "Revision APIs not wired"],
          ["parent", "unavailable", "unavailable", "Static scaffold row"],
        ]}
      />

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold">Forward cursor</h2>
          <p className="mt-1 text-sm text-muted-foreground">Returned as `start.signature`.</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold">Tree panel</h2>
          <p className="mt-1 text-sm text-muted-foreground">Large trees show truncation state.</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold">Diff panel</h2>
          <p className="mt-1 text-sm text-muted-foreground">Large diffs show truncation state.</p>
        </div>
      </div>
    </>
  );
}
