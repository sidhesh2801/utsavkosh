"use client";

import { FundsView } from "../funds/page";

/**
 * The expense ledger, open to every resident with no sign-in.
 */
export default function LedgerPage() {
  return (
    <FundsView
      only="expenses"
      title="Ledger"
      subtitle="Where every rupee went — item, vendor and bill number — and what is left."
    />
  );
}
