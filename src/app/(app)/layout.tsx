import { Sidebar } from "@/components/app/sidebar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 px-8 py-8">
        <div className="mx-auto max-w-[1600px]">{children}</div>
      </main>
    </div>
  );
}
