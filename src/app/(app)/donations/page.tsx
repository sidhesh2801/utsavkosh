"use client";

import { FundsView } from "../funds/page";

/**
 * The contribution list, open to every resident with no sign-in.
 */
export default function DonationsPage() {
  return (
    <FundsView
      only="donations"
      title="Donations"
      subtitle="Every contribution received, with the flat where we have it. Open to all residents."
    />
  );
}
