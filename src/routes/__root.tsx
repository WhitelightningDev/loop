import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { OrgProvider } from "@/features/organisations/OrgProvider";
import { ThemeProvider } from "@/features/theme/ThemeProvider";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Loop — Stay in the Loop" },
      {
        name: "description",
        content:
          "Loop is a premium internal messaging platform for teams: channels, DMs, threads, and admin in one place.",
      },
      { property: "og:title", content: "Loop — Stay in the Loop" },
      { property: "og:description", content: "Premium internal messaging for teams. Loop your team in." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/loop-icon.png" },
      { property: "og:image:width", content: "1024" },
      { property: "og:image:height", content: "1024" },
      { property: "og:image:alt", content: "Loop" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Loop — Stay in the Loop" },
      { name: "twitter:description", content: "Premium internal messaging for teams. Loop your team in." },
      { name: "twitter:image", content: "/loop-icon.png" },
      { name: "theme-color", content: "#8B5CF6" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/loop-icon.png" },
      { rel: "apple-touch-icon", href: "/loop-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }));
  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <AuthProvider>
          <OrgProvider>
            <Outlet />
            <Toaster richColors position="top-right" />
          </OrgProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
