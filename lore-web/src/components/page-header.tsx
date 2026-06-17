import { Badge } from "@/components/ui/badge";

type PageHeaderProps = {
  title: string;
  description: string;
  label?: string;
};

export function PageHeader({ title, description, label }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {label ? (
        <Badge variant="outline" className="w-fit">
          {label}
        </Badge>
      ) : null}
    </div>
  );
}
