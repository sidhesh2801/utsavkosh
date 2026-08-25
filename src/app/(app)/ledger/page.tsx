"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FundsView } from "@/components/funds-view";

/**
 * Open to every resident with no sign-in.
 *
 * `?activity=` arrives from a festival tile and pins the page to it, so the
 * totals at the top describe that festival rather than the society's year.
 */
export default function LedgerPage() {
  return (
    <Suspense fallback={null}>
      <Scoped />
    </Suspense>
  );
}

function Scoped() {
  const activityId = useSearchParams().get("activity") ?? undefined;
  return (
    <FundsView
      only="expenses"
      activityId={activityId}
      title="Ledger"
      subtitle="Where every rupee went — item, vendor and bill number — and what is left."
    />
  );
}
