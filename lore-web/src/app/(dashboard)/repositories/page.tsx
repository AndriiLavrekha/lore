import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { PlaceholderTable } from "@/components/placeholder-table";
import { Button } from "@/components/ui/button";

const sampleRepoId = "00112233445566778899aabbccddeeff";

export default function RepositoriesPage() {
  return (
    <>
      <PageHeader
        title="Repositories"
        description="Repository inventory placeholder. Streaming repository list, create, delete, and metadata pointer display are implemented in Phase 3."
        label="Placeholder data"
      />

      <div className="mb-4 flex justify-end">
        <Button asChild variant="outline">
          <Link href={`/repositories/${sampleRepoId}/branches`}>Open sample repo</Link>
        </Button>
      </div>

      <PlaceholderTable
        columns={["Name", "Repository id", "Default branch", "Status"]}
        rows={[
          ["sample", sampleRepoId, "main", "static"],
          ["integration", "ffeeddccbbaa99887766554433221100", "trunk", "static"],
        ]}
      />
    </>
  );
}
