import { devSections } from "../sections";

export function OverviewPage() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {devSections.map((section) => (
        <li key={section.slug}>
          <a
            href={`/dev/${section.slug}`}
            className="flex h-full flex-col gap-2 rounded-2xl border p-6 transition-colors hover:border-foreground"
          >
            <span className="font-heading text-lg font-bold">{section.title}</span>
            <span className="text-sm text-muted-foreground">{section.description}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
