import { PageHeader } from "@/components/page-header";
import { RepositoriesClient } from "@/components/repositories/repositories-client";
import type { RepositoryJson } from "@/server/grpc/repositories";

const sampleRepoId = "00112233445566778899aabbccddeeff";
const sampleRepositories: RepositoryJson[] = [
  {
    id: sampleRepoId,
    name: "sample",
    description: "Static fallback repository",
    defaultBranchId: "11".repeat(16),
    defaultBranchName: "main",
    creator: "operator",
    created: "0",
    metadata: "aa".repeat(32),
  },
  {
    id: "ffeeddccbbaa99887766554433221100",
    name: "integration",
    description: "Static fallback repository",
    defaultBranchId: "22".repeat(16),
    defaultBranchName: "trunk",
    creator: "operator",
    created: "0",
    metadata: "bb".repeat(32),
  },
];

export default function RepositoriesPage() {
  return (
    <>
      <PageHeader
        title="Repositories"
        description="Repository inventory, metadata pointers, creation, and guarded deletion."
        label="RepositoryService"
      />

      <RepositoriesClient initialItems={sampleRepositories} />
    </>
  );
}
