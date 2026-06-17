import { Activity, Database, Radio, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getServerConfig } from "@/server/config";
import { getCapabilityReport } from "@/server/grpc/capabilities";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const config = getServerConfig();
  const report = await getCapabilityReport({ config });
  const overviewCards = [
    {
      title: "HTTP health",
      value: report.health.status,
      description: report.health.message ?? report.target.http,
      icon: Activity,
    },
    {
      title: "Repository list",
      value: report.services.repositories.status,
      description: report.services.repositories.message ?? "RepositoryService probe result.",
      icon: Database,
    },
    {
      title: "Auth state",
      value: report.authState,
      description: `Auth mode: ${report.authMode}`,
      icon: ShieldCheck,
    },
    {
      title: "Activity",
      value: report.services.activity.status,
      description: report.services.activity.message ?? report.notificationStream ?? "Configured",
      icon: Radio,
    },
  ];

  return (
    <>
      <PageHeader
        title="Overview"
        description="Connectivity and capability status for the configured Lore server target."
        label={report.target.grpc}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.title}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{card.title}</CardTitle>
                  <Icon aria-hidden="true" className="text-muted-foreground" />
                </div>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{card.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </>
  );
}
