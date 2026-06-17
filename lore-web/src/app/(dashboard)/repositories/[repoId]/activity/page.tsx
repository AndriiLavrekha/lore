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
        description={`Live branch and lock activity for repository ${repoId}. Events arrive through the Next.js SSE bridge when a notification stream is configured.`}
        label="Notification stream"
      />

      <div className="mb-4 grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3">
        <input aria-label="Event filter" className="h-9 rounded-md border bg-background px-3 text-sm" placeholder="branch.created" />
        <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
          Reconnect state: idle
        </div>
        <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
          Notification stream: configure `LORE_WEB_NOTIFICATION_STREAM`
        </div>
      </div>

      <h2 className="mb-2 text-base font-semibold">Timeline</h2>
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
