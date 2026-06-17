import {
  Activity,
  BookOpen,
  GitBranch,
  History,
  LockKeyhole,
  LucideIcon,
  ServerCog,
  Settings,
} from "lucide-react";

export type DashboardNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const dashboardNavItems: DashboardNavItem[] = [
  {
    href: "/overview",
    label: "Overview",
    description: "Server health, target, and capability status.",
    icon: ServerCog,
  },
  {
    href: "/repositories",
    label: "Repositories",
    description: "Repository inventory and management actions.",
    icon: BookOpen,
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Connection, TLS, auth, and notification settings.",
    icon: Settings,
  },
];

export const repositoryFeatureItems = [
  {
    label: "Branches",
    description: "Live and deleted branch management placeholder.",
    icon: GitBranch,
  },
  {
    label: "Revision history",
    description: "History, tree, and diff placeholder.",
    icon: History,
  },
  {
    label: "Locks",
    description: "Repository lock management placeholder.",
    icon: LockKeyhole,
  },
  {
    label: "Activity",
    description: "Branch and lock event stream placeholder.",
    icon: Activity,
  },
];

export function repoScopedPlaceholderRoutes(repoId: string) {
  return [
    `/repositories/${repoId}/branches`,
    `/repositories/${repoId}/branches/placeholder/history`,
    `/repositories/${repoId}/locks`,
    `/repositories/${repoId}/activity`,
  ];
}
