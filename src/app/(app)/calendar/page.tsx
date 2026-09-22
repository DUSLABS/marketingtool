import { ComingSoon, PageHeader } from "@/components/app/page-header";

export default function Page() {
  return (
    <>
      <PageHeader title="Calendar" description="Scheduled posts across all campaigns." />
      <ComingSoon phase={5}>Not built yet.</ComingSoon>
    </>
  );
}
