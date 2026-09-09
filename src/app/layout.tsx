import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/features/shell/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InstallPrompt } from "@/features/shell/install-prompt";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  // Static pages bake this at build time, so the Dockerfile passes
  // BETTER_AUTH_URL in as a build arg.
  metadataBase: new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000"),
  title: { default: "Attendance", template: "%s · Attendance" },
  description: "Corporate attendance and leave tracker",
  // iOS ignores the manifest: it needs its own icon and its own standalone opt-in.
  appleWebApp: {
    capable: true,
    title: "Attendance",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  // Next emits the standard mobile-web-app-capable; iOS before 17.4 only reads
  // the apple- prefixed one, so both go out.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  // Lets the page paint under the notch and home indicator when installed;
  // the safe-area insets in the layout keep content clear of both.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#111318" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full antialiased", inter.variable, jetbrainsMono.variable)}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors position="top-center" />
          <InstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}
