import { LocksClient } from "@/components/locks/locks-client";
import { PageHeader } from "@/components/page-header";

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
        description={`Lock management for repository ${repoId}.`}
        label="Optional service"
      />

      <LocksClient repoId={repoId} />
    </>
  );
}
