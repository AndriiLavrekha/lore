import { ActivityClient } from "@/components/activity/activity-client";
import { PageHeader } from "@/components/page-header";

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
        description={`Live branch and lock activity for repository ${repoId}.`}
        label="Notification stream"
      />

      <ActivityClient repoId={repoId} />
    </>
  );
}
