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
        description={`Static history placeholder for branch ${branchId} in repository ${repoId}. Cursor pagination, tree, and diff streams are implemented in Phase 6.`}
        label="Stream capped later"
      />

      <PlaceholderTable
        columns={["Revision", "Author", "Created", "Summary"]}
        rows={[
          ["tip", "unavailable", "unavailable", "Revision APIs not wired"],
          ["parent", "unavailable", "unavailable", "Static scaffold row"],
        ]}
      />
    </>
  );
}
