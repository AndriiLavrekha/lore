import { BranchesClient } from "@/components/branches/branches-client";
import { PageHeader } from "@/components/page-header";

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
        description={`Branch management controls for repository ${repoId}.`}
        label="Repo scoped"
      />

      <BranchesClient repoId={repoId} />
    </>
  );
}
