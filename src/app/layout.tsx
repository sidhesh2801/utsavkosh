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
