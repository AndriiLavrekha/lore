import { Activity, Database, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const overviewCards = [
  {
    title: "HTTP health",
    value: "Not connected",
    description: "Phase 0 does not call /health_check.",
    icon: Activity,
  },
  {
    title: "Repositories",
    value: "Static shell",
    description: "Repository APIs are added in later phases.",
    icon: Database,
  },
  {
    title: "Auth",
    value: "None",
    description: "Token handling remains server-only in later phases.",
    icon: ShieldCheck,
  },
];

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="Static management dashboard shell for a Lore server. Connectivity, capability probes, and auth state are implemented after the scaffold phase."
        label="No server required"
      />

      <section className="grid gap-4 md:grid-cols-3">
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
