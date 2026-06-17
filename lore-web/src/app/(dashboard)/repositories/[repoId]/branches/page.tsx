import Link from "next/link";

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
        description={`Static branch management placeholder for repository ${repoId}. Repo-scoped gRPC metadata is implemented in Phase 1 and branch RPCs in Phase 4.`}
        label="Repo scoped"
      />

      <div className="mb-4 flex justify-end">
        <Button asChild variant="outline">
          <Link href={`/repositories/${repoId}/branches/placeholder/history`}>
            Open history placeholder
          </Link>
        </Button>
      </div>

      <PlaceholderTable
        columns={["Branch", "Category", "Tip", "Protection"]}
        rows={[
          ["main", "live", "unavailable", "unknown"],
          ["release", "live", "unavailable", "unknown"],
        ]}
      />
    </>
  );
}
