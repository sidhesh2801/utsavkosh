import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SocietyProvider } from "@/lib/store";
import { ToastProvider } from "@/components/ui";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "UtsavKosh — cultural activities & funds",
    template: "%s · UtsavKosh",
  },
  description:
    "Every rupee collected and spent, every activity planned, and every photograph — open to all residents of the society.",
  appleWebApp: {
    capable: true,
    title: "UtsavKosh",
    statusBarStyle: "default",
  },
  /**
   * The accounts and receipts are open to residents without a login, which
   * means donor names and amounts sit on a public URL. That's how a notice
   * board works, but a search engine is a different matter — so the app asks
   * not to be indexed. Anyone with the link still gets in.
   */
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0e5c4b",
  /* Residents will pin this to the home screen, so fill the notch area. */
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-dvh">
        <SocietyProvider>
          <ToastProvider>{children}</ToastProvider>
        </SocietyProvider>
      </body>
    </html>
  );
}
