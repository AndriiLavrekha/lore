import { describe, expect, it } from "vitest";
import {
  dashboardNavItems,
  repoScopedPlaceholderRoutes,
} from "@/lib/navigation";

describe("dashboard navigation", () => {
  it("exposes the phase 0 top-level dashboard routes", () => {
    expect(dashboardNavItems.map((item) => item.href)).toEqual([
      "/overview",
      "/repositories",
      "/settings",
    ]);
  });

  it("keeps repo-scoped placeholder routes under the repository URL", () => {
    expect(repoScopedPlaceholderRoutes("00112233445566778899aabbccddeeff")).toEqual([
      "/repositories/00112233445566778899aabbccddeeff/branches",
      "/repositories/00112233445566778899aabbccddeeff/branches/placeholder/history",
      "/repositories/00112233445566778899aabbccddeeff/locks",
      "/repositories/00112233445566778899aabbccddeeff/activity",
    ]);
  });
});
