"use client";

import { useMemo, useRef, useState } from "react";
import { useSociety } from "@/lib/store";
import { flatLabel, shortDate } from "@/lib/format";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  SectionTitle,
  useConfirm,
  useToast,
} from "@/components/ui";
import type { Member, Role } from "@/lib/types";

const roleLabel: Record<Role, string> = {
  admin: "Committee admin",
  volunteer: "Volunteer",
  resident: "Resident",
};

export default function AdminPage() {
  const { data, isAdmin } = useSociety();

  if (!isAdmin) {
    return (
      <EmptyState
        title="Committee admins only"
        description="This screen manages members and society settings. Ask a committee admin if you need something changed."
      />
    );
  }

  const pending = data.members.filter((m) => m.status === "pending");
  const approved = data.members.filter((m) => m.status === "approved");
  const rejected = data.members.filter((m) => m.status === "rejected");

  return (
    <div className="space-y-7">
      <PageHeader
        title="Manage society"
        subtitle="Approve new residents, decide who can record collections, and edit society details."
      />

      <section>
        <SectionTitle>
          Waiting for approval{pending.length ? ` — ${pending.length}` : ""}
        </SectionTitle>
        {pending.length ? (
          <Card>
            <ul className="divide-y divide-line">
              {pending.map((m) => (
                <PendingRow key={m.id} member={m} />
              ))}
            </ul>
          </Card>
        ) : (
          <Card className="px-4 py-6 text-center">
            <p className="text-sm text-ink-soft">No registrations waiting.</p>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>Members — {approved.length}</SectionTitle>
        <Card>
          <ul className="divide-y divide-line">
            {approved
              .slice()
              .sort((a, b) => `${a.wing}${a.flat}`.localeCompare(`${b.wing}${b.flat}`))
              .map((m) => (
                <MemberRow key={m.id} member={m} />
              ))}
          </ul>
        </Card>
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          Volunteers can record contributions but cannot edit expenses, delete entries, or
          verify their own handovers. Committee admins can do everything.
        </p>
      </section>

      {rejected.length ? (
        <section>
          <SectionTitle>Not approved — {rejected.length}</SectionTitle>
          <Card>
            <ul className="divide-y divide-line">
              {rejected.map((m) => (
                <MemberRow key={m.id} member={m} />
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <PaymentQrs />
      <SocietySettings />
      <DangerZone />
    </div>
  );
}

function PendingRow({ member }: { member: Member }) {
  const { approveMember, rejectMember } = useSociety();
  const toast = useToast();

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Avatar name={member.name} tone="neutral" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{member.name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
          <span className="tnum font-medium">{flatLabel(member.wing, member.flat)}</span>
          <span className="tnum">{member.mobile}</span>
          <span className="truncate">{member.email}</span>
        </p>
        <p className="tnum mt-0.5 text-[0.6875rem] text-ink-faint">
          Registered {shortDate(member.joinedAt)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            const r = await rejectMember(member.id);
            toast(r.ok ? `${member.name} was not approved.` : r.error, r.ok ? "success" : "error");
          }}
        >
          Reject
        </Button>
        <Button
          size="sm"
          onClick={async () => {
            const r = await approveMember(member.id);
            toast(r.ok ? `${member.name} can now sign in.` : r.error, r.ok ? "success" : "error");
          }}
        >
          Approve
        </Button>
      </div>
    </li>
  );
}

function MemberRow({ member }: { member: Member }) {
  const { setMemberRole, removeMember, approveMember, session } = useSociety();
  const toast = useToast();
  const confirm = useConfirm();
  const isMe = member.id === session?.id;

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Avatar
        name={member.name}
        tone={member.role === "admin" ? "brand" : member.role === "volunteer" ? "accent" : "neutral"}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">
          {member.name}
          {isMe ? <span className="ml-1.5 text-xs font-normal text-ink-faint">(you)</span> : null}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
          <span className="tnum font-medium">{flatLabel(member.wing, member.flat)}</span>
          <span className="tnum">{member.mobile}</span>
        </p>
        {member.status === "rejected" ? <Badge tone="debit" className="mt-1.5">Not approved</Badge> : null}
      </div>

      {member.status === "approved" ? (
        <label className="flex items-center gap-2">
          <span className="sr-only">Role for {member.name}</span>
          <select
            className="field w-auto py-1.5 text-[0.8125rem]"
            value={member.role}
            onChange={async (e) => {
              const r = await setMemberRole(member.id, e.target.value as Role);
              toast(r.ok ? "Role updated." : r.error, r.ok ? "success" : "error");
            }}
          >
            {(Object.keys(roleLabel) as Role[]).map((role) => (
              <option key={role} value={role}>
                {roleLabel[role]}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            const r = await approveMember(member.id);
            toast(r.ok ? `${member.name} can now sign in.` : r.error, r.ok ? "success" : "error");
          }}
        >
          Approve after all
        </Button>
      )}

      {!isMe ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            if (
              !confirm(
                `Remove ${member.name} from the society register? Entries they recorded stay in the ledger.`,
              )
            )
              return;
            const r = await removeMember(member.id);
            toast(r.ok ? `${member.name} removed.` : r.error, r.ok ? "success" : "error");
          }}
        >
          Remove
        </Button>
      ) : null}
    </li>
  );
}

/**
 * The society's payment QR images — the ones the bank or PhonePe issued.
 * Volunteers show these at the door for residents to scan.
 */
function PaymentQrs() {
  const { data, addPaymentQr, removePaymentQr } = useSociety();
  const toast = useToast();
  const confirm = useConfirm();
  const fileInput = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [activityId, setActivityId] = useState("");
  const [busy, setBusy] = useState(false);

  const qrs = data.paymentQrs ?? [];

  async function onPicked(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    const r = await addPaymentQr(label, file, activityId || null);
    setBusy(false);
    if (fileInput.current) fileInput.current.value = "";
    if (r.ok) {
      setLabel("");
      setActivityId("");
      toast("QR added — volunteers can show it at the door now.");
    } else {
      toast(r.error, "error");
    }
  }

  return (
    <section>
      <SectionTitle>Payment QR codes — {qrs.length}</SectionTitle>
      <Card className="space-y-4 p-4">
        <p className="rounded-lg bg-warn-soft px-3 py-2.5 text-xs leading-relaxed text-warn">
          Upload only a QR for the society&apos;s <strong>registered current account</strong>.
          Collecting festival contributions into a committee member&apos;s personal UPI creates a
          tax and audit problem for that person, and banks flag it at these volumes.
        </p>

        {qrs.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {qrs.map((qr) => (
              <li key={qr.id} className="rounded-xl border border-line p-3">
                {qr.src ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={qr.src}
                    alt={`QR code — ${qr.label}`}
                    className="mx-auto h-32 w-32 object-contain"
                  />
                ) : (
                  <div className="mx-auto grid h-32 w-32 place-items-center rounded-lg bg-surface-sunken text-xs text-ink-faint">
                    Image missing
                  </div>
                )}
                <p className="mt-2 text-center text-[0.8125rem] font-medium text-ink">{qr.label}</p>
                {qr.activityId ? (
                  <p className="mt-0.5 text-center text-[0.6875rem] text-ink-faint">
                    {data.activities.find((a) => a.id === qr.activityId)?.title ?? "Activity"}
                  </p>
                ) : (
                  <p className="mt-0.5 text-center text-[0.6875rem] text-ink-faint">
                    Shown for all activities
                  </p>
                )}
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Remove the QR “${qr.label}”?`)) return;
                      const r = await removePaymentQr(qr.id);
                      toast(r.ok ? "QR removed." : r.error, r.ok ? "success" : "error");
                    }}
                    className="text-[0.6875rem] font-medium text-debit underline decoration-debit/30 underline-offset-2"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[0.8125rem] text-ink-soft">
            No QR uploaded yet. Take a screenshot or photo of the QR your bank gave the society and
            add it below.
          </p>
        )}

        <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <Field label="Label" hint="What volunteers will see, e.g. “Janmashtami — SBI”." required>
            <input
              className="field"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Janmashtami Fund — SBI current a/c"
            />
          </Field>
          <Field label="For which activity" hint="Leave blank to show it for every collection.">
            <select
              className="field"
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
            >
              <option value="">All activities</option>
              {data.activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onPicked(e.target.files)}
          />
          <Button disabled={!label.trim() || busy} onClick={() => fileInput.current?.click()}>
            {busy ? "Adding…" : "Upload QR image"}
          </Button>
        </div>
      </Card>
    </section>
  );
}

function SocietySettings() {
  const { data, updateSociety } = useSociety();
  const toast = useToast();
  const [name, setName] = useState(data.society.name);
  const [address, setAddress] = useState(data.society.address);
  const [wings, setWings] = useState(data.society.wings.join(", "));
  const [prefix, setPrefix] = useState(data.society.receiptPrefix ?? "");

  const dirty =
    name !== data.society.name ||
    address !== data.society.address ||
    wings !== data.society.wings.join(", ") ||
    prefix !== (data.society.receiptPrefix ?? "");

  return (
    <section>
      <SectionTitle>Society details</SectionTitle>
      <Card className="space-y-3.5 p-4">
        <Field label="Society name" required>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Address">
          <input className="field" value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field
          label="Towers / wings"
          hint="Comma separated, e.g. A, B, C, D. Used in the flat pickers."
        >
          <input className="field" value={wings} onChange={(e) => setWings(e.target.value)} />
        </Field>
        <Field
          label="Receipt prefix"
          hint={`Receipts read ${prefix || "WPC"}/2026-27/0001. Set this before issuing the first receipt — changing it later makes the series look like it has gaps.`}
        >
          <input
            className="field uppercase"
            value={prefix}
            maxLength={8}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            placeholder="WPC"
          />
        </Field>
        <div className="flex justify-end">
          <Button
            disabled={!dirty}
            onClick={async () => {
              const r = await updateSociety({
                name: name.trim(),
                address: address.trim(),
                receiptPrefix: prefix.trim() || undefined,
                wings: wings
                  .split(",")
                  .map((w) => w.trim().toUpperCase())
                  .filter(Boolean),
              });
              toast(r.ok ? "Society details saved." : r.error, r.ok ? "success" : "error");
            }}
          >
            Save details
          </Button>
        </div>
      </Card>
    </section>
  );
}

function DangerZone() {
  const { data, resetToSampleData, startFresh } = useSociety();
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [wings, setWings] = useState("A, B, C");

  const counts = useMemo(
    () => ({
      donations: data.donations.length,
      expenses: data.expenses.length,
      activities: data.activities.length,
      photos: data.photos.length,
    }),
    [data],
  );

  return (
    <section>
      <SectionTitle>Starting with your own society</SectionTitle>
      <Card className="space-y-4 p-4">
        <p className="text-[0.8125rem] leading-relaxed text-ink-soft">
          This app currently holds sample data — {counts.donations} donations, {counts.expenses}{" "}
          expenses, {counts.activities} activities and {counts.photos} photographs for a fictional
          society. When you&apos;re ready to use it for real, clear it and start with an empty
          register. Your own admin account is kept.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Your society's name" required>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sai Residency CHS"
            />
          </Field>
          <Field label="Address">
            <input className="field" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <Field label="Wings">
            <input className="field" value={wings} onChange={(e) => setWings(e.target.value)} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="danger"
            disabled={!name.trim()}
            onClick={async () => {
              if (
                !confirm(
                  `Delete all sample data and start fresh as “${name.trim()}”? This cannot be undone.`,
                )
              )
                return;
              const r = await startFresh(
                name,
                address,
                wings
                  .split(",")
                  .map((w) => w.trim().toUpperCase())
                  .filter(Boolean),
              );
              toast(
                r.ok ? "Ready — the register is empty and yours." : r.error,
                r.ok ? "success" : "error",
              );
            }}
          >
            Clear everything and start fresh
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              if (!confirm("Discard all changes and restore the original sample data?")) return;
              await resetToSampleData();
              toast("Sample data restored. Please sign in again.");
            }}
          >
            Restore sample data
          </Button>
        </div>
      </Card>
    </section>
  );
}
