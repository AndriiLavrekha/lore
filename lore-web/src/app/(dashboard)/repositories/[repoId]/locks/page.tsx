import { PageHeader } from "@/components/page-header";
import { PlaceholderTable } from "@/components/placeholder-table";

type LocksPageProps = {
  params: Promise<{
    repoId: string;
  }>;
};

export default async function LocksPage({ params }: LocksPageProps) {
  const { repoId } = await params;

  return (
    <>
      <PageHeader
        title="Locks"
        description={`Static lock placeholder for repository ${repoId}. Lock service discovery and lock operations are implemented in Phase 7.`}
        label="Optional service"
      />

      <PlaceholderTable
        columns={["Resource", "Owner", "Branch", "Status"]}
        rows={[
          ["/README.md", "unavailable", "main", "static"],
          ["/docs", "unavailable", "release", "static"],
        ]}
      />
    </>
  );
}
