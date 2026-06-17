import { PageHeader } from "@/components/page-header";
import { PlaceholderTable } from "@/components/placeholder-table";

type ActivityPageProps = {
  params: Promise<{
    repoId: string;
  }>;
};

export default async function ActivityPage({ params }: ActivityPageProps) {
  const { repoId } = await params;

  return (
    <>
      <PageHeader
        title="Activity"
        description={`Static activity placeholder for repository ${repoId}. NotificationService SSE bridging is implemented in Phase 8.`}
        label="Stream name required later"
      />

      <PlaceholderTable
        columns={["Event", "Object", "Received", "Status"]}
        rows={[
          ["branch", "main", "unavailable", "static"],
          ["lock", "/README.md", "unavailable", "static"],
        ]}
      />
    </>
  );
}
