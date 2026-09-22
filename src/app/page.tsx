import Link from "next/link";
import { redirect } from "next/navigation";
import { Images, Megaphone, Send } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/app/logo";
import { OPERATOR } from "@/components/app/legal-page";
import { createClient } from "@/lib/supabase/server";

// Public landing page: explains the app to TikTok's app reviewers and to anyone following the link.
const steps = [
  {
    icon: Megaphone,
    title: "Define a campaign",
    text: "Hooks, a content prompt and a call to action for one of our apps.",
  },
  {
    icon: Images,
    title: "Build slideshows",
    text: "Each post combines a hook, AI-written content slides and images from our own libraries.",
  },
  {
    icon: Send,
    title: "Publish to TikTok",
    text: "Posts are sent to our own TikTok accounts, either as drafts for review or at scheduled times.",
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4">
      <header className="flex items-center justify-between py-6">
        <Logo />
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>
          Sign in
        </Link>
      </header>

      <main className="flex-1 py-20">
        <p className="text-xs font-medium tracking-widest text-primary">INTERNAL TOOL</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          TikTok slideshows for our apps, created and scheduled in one place.
        </h1>
        <p className="mt-5 max-w-xl text-muted-foreground">
          Slides Autopilot is used by the {OPERATOR.brand} team to create photo slideshow posts and publish them to our
          own TikTok accounts. Access is limited to invited team members.
        </p>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }) => (
            <div key={title} className="panel p-5">
              <Icon className="size-5 text-primary" />
              <h2 className="mt-4 text-sm font-medium">{title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>

        <p className="mt-14 max-w-xl text-sm text-muted-foreground">
          The app connects to TikTok through TikTok Login Kit and the Content Posting API. It only accesses accounts
          that a team member connects, and only to publish content created in the app and to show how that content
          performs.
        </p>
      </main>

      <footer className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border py-6 text-sm text-muted-foreground">
        <span>© 2026 {OPERATOR.brand}</span>
        <Link href="/privacy" className="hover:text-foreground">
          Privacy Policy
        </Link>
        <Link href="/terms" className="hover:text-foreground">
          Terms of Service
        </Link>
        <Link href="/imprint" className="hover:text-foreground">
          Imprint
        </Link>
        <a href={`mailto:${OPERATOR.email}`} className="hover:text-foreground">
          Contact
        </a>
      </footer>
    </div>
  );
}
