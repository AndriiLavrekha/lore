import { PageHeader } from "@/components/page-header";
import { RevisionHistoryClient } from "@/components/revisions/revision-history-client";

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
        description={`Newest-to-oldest revision history for branch ${branchId}.`}
        label="Cursor paged"
      />

      <RevisionHistoryClient repoId={repoId} branchId={branchId} />
    </>
  );
}
