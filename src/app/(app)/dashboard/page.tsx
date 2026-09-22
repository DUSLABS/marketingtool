import { PageHeader } from "@/components/app/page-header";

const stats = ["Posts published", "Views", "Engagement", "Connected accounts"];

export default function HomePage() {
  return (
    <>
      <PageHeader title="Home" description="What your campaigns are doing right now." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((label) => (
          <div key={label} className="panel p-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">–</p>
          </div>
        ))}
      </div>
    </>
  );
}
