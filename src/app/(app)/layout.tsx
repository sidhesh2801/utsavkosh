import { AppShell } from "@/components/app-shell";

/**
 * Wraps every screen that requires a signed-in member. `/login` sits outside
 * this group so it renders without the navigation chrome.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
