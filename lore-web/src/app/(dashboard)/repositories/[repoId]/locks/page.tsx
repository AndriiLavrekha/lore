import { PageHeader } from "@/components/page-header";
import { PlaceholderTable } from "@/components/placeholder-table";
import { Button } from "@/components/ui/button";

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
        description={`Lock management for repository ${repoId}. LockService availability is reported in capabilities.`}
        label="Optional service"
      />

      <div className="mb-4 grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-5">
        <input aria-label="Branch filter" className="h-9 rounded-md border bg-background px-3 text-sm" placeholder="branch id" />
        <input aria-label="Owner filter" className="h-9 rounded-md border bg-background px-3 text-sm" placeholder="owner" />
        <input aria-label="Path filter" className="h-9 rounded-md border bg-background px-3 text-sm" placeholder="/path" />
        <Button type="button">Acquire lock</Button>
        <Button type="button" variant="outline">Admin lock</Button>
      </div>

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
