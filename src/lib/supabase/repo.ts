import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EXPENSE_COLUMNS,
  getSupabase,
  PUBLIC_DONATION_COLUMNS,
  STAFF_DONATION_COLUMNS,
} from "./client";
import type {
  Activity,
  Album,
  Donation,
  Expense,
  Member,
  PaymentQr,
  Photo,
  SocietyData,
} from "../types";

/**
 * Supabase implementation of every read and write the app performs.
 *
 * Database columns are snake_case and the domain model is camelCase, so the
 * mapping lives here and nowhere else. The screens never see a row.
 */

/* --------------------------------------------------------------- mapping */

/** Rows come back with unknown shape; these casts are the boundary. */
type Row = Record<string, unknown>;

const str = (v: unknown): string => (v == null ? "" : String(v));
const opt = (v: unknown): string | undefined =>
  v == null || v === "" ? undefined : String(v);
const num = (v: unknown): number => (v == null ? 0 : Number(v));

function toMember(r: Row): Member {
  return {
    id: str(r.id),
    name: str(r.name),
    email: str(r.email),
    mobile: str(r.mobile),
    wing: str(r.wing),
    flat: str(r.flat),
    role: str(r.role) as Member["role"],
    status: str(r.status) as Member["status"],
    joinedAt: str(r.joined_at),
  };
}

function toActivity(r: Row): Activity {
  return {
    id: str(r.id),
    title: str(r.title),
    description: str(r.description),
    category: str(r.category) as Activity["category"],
    startsAt: str(r.starts_at),
    endsAt: opt(r.ends_at),
    venue: str(r.venue),
    budget: num(r.budget),
    status: str(r.status) as Activity["status"],
    organiser: str(r.organiser),
    createdAt: str(r.created_at),
  };
}

function toDonation(r: Row): Donation {
  return {
    id: str(r.id),
    receiptNo: str(r.receipt_no),
    donorName: str(r.donor_name),
    donorMobile: opt(r.donor_mobile),
    wing: opt(r.wing),
    flat: opt(r.flat),
    isTenant: Boolean(r.is_tenant),
    amount: num(r.amount),
    method: str(r.method) as Donation["method"],
    reference: opt(r.reference),
    activityId: r.activity_id == null ? null : str(r.activity_id),
    receivedAt: str(r.received_at),
    note: opt(r.note),
    status: str(r.status) as Donation["status"],
    recordedBy: str(r.recorded_by),
    verifiedBy: opt(r.verified_by),
    verifiedAt: opt(r.verified_at),
    receiptSentAt: opt(r.receipt_sent_at),
    proofPhotoId: opt(r.proof_path),
    proofSrc: null,
    createdAt: str(r.created_at),
  };
}

function toExpense(r: Row): Expense {
  return {
    id: str(r.id),
    title: str(r.title),
    category: str(r.category) as Expense["category"],
    amount: num(r.amount),
    vendor: opt(r.vendor),
    activityId: r.activity_id == null ? null : str(r.activity_id),
    paidAt: str(r.paid_at),
    method: str(r.method) as Expense["method"],
    billNo: opt(r.bill_no),
    paidBy: opt(r.paid_by),
    note: opt(r.note),
    hasBill: Boolean(r.has_bill),
    recordedBy: str(r.recorded_by),
    createdAt: str(r.created_at),
  };
}

function toAlbum(r: Row): Album {
  return {
    id: str(r.id),
    title: str(r.title),
    activityId: r.activity_id == null ? null : str(r.activity_id),
    date: str(r.date),
    description: opt(r.description),
    createdAt: str(r.created_at),
  };
}

/* ---------------------------------------------------------------- loading */

function client(): SupabaseClient {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

/** Signed URLs for a private bucket, keyed by storage path. */
async function signPaths(
  bucket: string,
  paths: string[],
  seconds = 3600,
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const { data, error } = await client()
    .storage.from(bucket)
    .createSignedUrls(unique, seconds);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  data.forEach((entry, i) => {
    if (entry.signedUrl) out[unique[i]] = entry.signedUrl;
  });
  return out;
}

function publicUrl(bucket: string, path: string): string {
  return client().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/**
 * Loads the whole register in one go.
 *
 * Loading everything is deliberate and stays affordable because images are URLs
 * rather than inline data: even 1800 flats across several festivals is a few
 * thousand small rows. If the ledger ever outgrows that, the fix is to page the
 * donations query here without touching any screen.
 */
export async function loadAll(signedIn: boolean): Promise<SocietyData> {
  const supabase = client();

  const [societyRes, activitiesRes, donationsRes, expensesRes, albumsRes, photosRes] =
    await Promise.all([
      supabase.from("societies").select("*").limit(1).maybeSingle(),
      supabase.from("activities").select("*").order("starts_at", { ascending: false }),
      supabase
        .from("donations")
        .select(signedIn ? STAFF_DONATION_COLUMNS : PUBLIC_DONATION_COLUMNS)
        .order("received_at", { ascending: false }),
      supabase.from("expenses").select(EXPENSE_COLUMNS).order("paid_at", { ascending: false }),
      supabase.from("albums").select("*").order("date", { ascending: false }),
      supabase.from("photos").select("*").order("uploaded_at", { ascending: true }),
    ]);

  const firstError =
    societyRes.error ??
    activitiesRes.error ??
    donationsRes.error ??
    expensesRes.error ??
    albumsRes.error ??
    photosRes.error;
  if (firstError) throw new Error(firstError.message);

  // Members and payment QRs are staff-only; a guest simply gets empty lists.
  let members: Member[] = [];
  let paymentQrs: PaymentQr[] = [];
  if (signedIn) {
    const [membersRes, qrRes] = await Promise.all([
      supabase.from("members").select("*").order("wing").order("flat"),
      supabase.from("payment_qrs").select("*").order("added_at"),
    ]);
    members = (membersRes.data ?? []).map((r) => toMember(r as Row));
    const qrRows = (qrRes.data ?? []) as Row[];
    const signed = await signPaths(
      "qrcodes",
      qrRows.map((r) => str(r.storage_path)),
    );
    paymentQrs = qrRows.map((r) => ({
      id: str(r.id),
      label: str(r.label),
      imageId: str(r.storage_path),
      src: signed[str(r.storage_path)] ?? null,
      activityId: r.activity_id == null ? null : str(r.activity_id),
      archived: Boolean(r.archived),
      addedAt: str(r.added_at),
    }));
  }

  // Double cast: with a runtime-chosen column list supabase-js can't infer the
  // row shape, so it falls back to an error-ish type that needs unwinding.
  const donations = ((donationsRes.data ?? []) as unknown as Row[]).map(toDonation);

  // Proof images live in a private bucket, so they need signing — and only
  // staff can read them at all.
  if (signedIn) {
    const proofUrls = await signPaths(
      "proofs",
      donations.map((d) => d.proofPhotoId ?? ""),
    );
    for (const d of donations) {
      if (d.proofPhotoId) d.proofSrc = proofUrls[d.proofPhotoId] ?? null;
    }
  }

  const photos: Photo[] = ((photosRes.data ?? []) as Row[]).map((r) => ({
    id: str(r.id),
    albumId: str(r.album_id),
    caption: opt(r.caption),
    src: publicUrl("gallery", str(r.storage_path)),
    uploadedAt: str(r.uploaded_at),
  }));

  const societyRow = (societyRes.data ?? {}) as Row;

  return {
    society: {
      name: str(societyRow.name) || "Your society",
      address: str(societyRow.address),
      wings: (societyRow.wings as string[] | null) ?? [],
      receiptPrefix: opt(societyRow.receipt_prefix),
    },
    members,
    activities: ((activitiesRes.data ?? []) as Row[]).map(toActivity),
    donations,
    // `as unknown` for the same reason as donations above: the column list is
    // chosen at runtime, so supabase-js can't infer the row shape from it.
    expenses: ((expensesRes.data ?? []) as unknown as Row[]).map(toExpense),
    albums: ((albumsRes.data ?? []) as Row[]).map(toAlbum),
    photos,
    paymentQrs,
  };
}

/* ------------------------------------------------------------------- auth */

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await client().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  return error ? error.message : null;
}

export async function signOut(): Promise<void> {
  await client().auth.signOut();
}

/** The signed-in user's member row, or null when browsing as a guest. */
export async function currentMember(): Promise<Member | null> {
  const supabase = client();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error || !data) return null;
  return toMember(data as Row);
}

/**
 * Creates a login for a volunteer or admin.
 *
 * Goes through our own server route rather than straight to Supabase, because
 * creating a user needs the service_role key and that must stay on the server.
 */
export async function createStaffAccount(input: {
  name: string;
  email: string;
  password: string;
  mobile?: string;
  wing?: string;
  flat?: string;
  role: "admin" | "volunteer";
}): Promise<void> {
  const { data } = await client().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again.");

  const res = await fetch("/api/staff", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  const payload = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(payload.error ?? "Could not create the account.");
}

/* -------------------------------------------------------------- mutations */

/** `undefined` values are dropped so a patch never blanks an untouched column. */
function clean(row: Row): Row {
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));
}

export async function insertDonation(
  input: Omit<Donation, "id" | "createdAt" | "receiptNo">,
): Promise<string> {
  // receipt_no is assigned by a database trigger, not sent from here — with
  // several volunteers saving at once, a client-side counter would collide.
  const { data, error } = await client()
    .from("donations")
    .insert(
      clean({
        donor_name: input.donorName,
        donor_mobile: input.donorMobile ?? null,
        wing: input.wing ?? null,
        flat: input.flat ?? null,
        is_tenant: input.isTenant ?? false,
        amount: input.amount,
        method: input.method,
        reference: input.reference ?? null,
        activity_id: input.activityId,
        received_at: input.receivedAt,
        note: input.note ?? null,
        status: input.status,
        recorded_by: input.recordedBy,
        verified_by: input.verifiedBy ?? null,
        verified_at: input.verifiedAt ?? null,
      }),
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return str((data as Row).id);
}

export async function updateDonation(id: string, patch: Partial<Donation>): Promise<void> {
  const { error } = await client()
    .from("donations")
    .update(
      clean({
        donor_name: patch.donorName,
        donor_mobile: patch.donorMobile,
        wing: patch.wing,
        flat: patch.flat,
        is_tenant: patch.isTenant,
        amount: patch.amount,
        method: patch.method,
        reference: patch.reference,
        activity_id: patch.activityId,
        received_at: patch.receivedAt,
        note: patch.note,
        status: patch.status,
        verified_by: patch.verifiedBy,
        verified_at: patch.verifiedAt,
        receipt_sent_at: patch.receiptSentAt,
        proof_path: patch.proofPhotoId,
      }),
    )
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteDonation(id: string): Promise<void> {
  const { error } = await client().from("donations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Bulk handover confirmation, done in one statement rather than N round trips. */
export async function verifyAllFrom(
  volunteerId: string,
  activityId: string | null | undefined,
  verifierId: string,
): Promise<number> {
  let query = client()
    .from("donations")
    .update({
      status: "verified",
      verified_by: verifierId,
      verified_at: new Date().toISOString(),
    })
    .eq("recorded_by", volunteerId)
    .eq("status", "pending");
  if (activityId !== undefined) {
    query = activityId === null ? query.is("activity_id", null) : query.eq("activity_id", activityId);
  }
  const { data, error } = await query.select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

export async function insertExpense(
  input: Omit<Expense, "id" | "createdAt">,
): Promise<void> {
  const { error } = await client()
    .from("expenses")
    .insert(
      clean({
        title: input.title,
        category: input.category,
        amount: input.amount,
        vendor: input.vendor ?? null,
        activity_id: input.activityId,
        paid_at: input.paidAt,
        method: input.method,
        bill_no: input.billNo ?? null,
        paid_by: input.paidBy ?? null,
        note: input.note ?? null,
        recorded_by: input.recordedBy,
      }),
    );
  if (error) throw new Error(error.message);
}

export async function updateExpense(id: string, patch: Partial<Expense>): Promise<void> {
  const { error } = await client()
    .from("expenses")
    .update(
      clean({
        title: patch.title,
        category: patch.category,
        amount: patch.amount,
        vendor: patch.vendor,
        activity_id: patch.activityId,
        paid_at: patch.paidAt,
        method: patch.method,
        bill_no: patch.billNo,
        paid_by: patch.paidBy,
        note: patch.note,
      }),
    )
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await client().from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function insertActivity(input: Omit<Activity, "id" | "createdAt">): Promise<void> {
  const { error } = await client()
    .from("activities")
    .insert(
      clean({
        title: input.title,
        description: input.description,
        category: input.category,
        starts_at: input.startsAt,
        ends_at: input.endsAt ?? null,
        venue: input.venue,
        budget: input.budget,
        status: input.status,
        organiser: input.organiser,
      }),
    );
  if (error) throw new Error(error.message);
}

export async function updateActivity(id: string, patch: Partial<Activity>): Promise<void> {
  const { error } = await client()
    .from("activities")
    .update(
      clean({
        title: patch.title,
        description: patch.description,
        category: patch.category,
        starts_at: patch.startsAt,
        ends_at: patch.endsAt,
        venue: patch.venue,
        budget: patch.budget,
        status: patch.status,
        organiser: patch.organiser,
      }),
    )
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteActivity(id: string): Promise<void> {
  // The foreign keys are ON DELETE RESTRICT, so Postgres refuses if money is
  // attached — surface that as a readable message rather than a raw code.
  const { error } = await client().from("activities").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      throw new Error(
        "This activity has donations or expenses recorded against it. Reassign or delete those entries first so the ledger stays correct.",
      );
    }
    throw new Error(error.message);
  }
}

export async function insertAlbum(input: Omit<Album, "id" | "createdAt">): Promise<string> {
  const { data, error } = await client()
    .from("albums")
    .insert(
      clean({
        title: input.title,
        activity_id: input.activityId,
        date: input.date,
        description: input.description ?? null,
      }),
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return str((data as Row).id);
}

export async function updateAlbum(id: string, patch: Partial<Album>): Promise<void> {
  const { error } = await client()
    .from("albums")
    .update(
      clean({
        title: patch.title,
        activity_id: patch.activityId,
        date: patch.date,
        description: patch.description,
      }),
    )
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteAlbum(id: string): Promise<void> {
  const supabase = client();
  // Remove the image files first; the rows cascade with the album.
  const { data } = await supabase.from("photos").select("storage_path").eq("album_id", id);
  const paths = (data ?? []).map((r) => str((r as Row).storage_path)).filter(Boolean);
  if (paths.length) await supabase.storage.from("gallery").remove(paths);
  const { error } = await supabase.from("albums").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------------------------------------------------------------- storage */

/** Turns a stored data URL into a Blob for upload. */
async function toBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

function objectPath(prefix: string, ext = "jpg"): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}/${random}.${ext}`;
}

export async function uploadGalleryPhoto(
  albumId: string,
  dataUrl: string,
  caption: string,
): Promise<void> {
  const supabase = client();
  const path = objectPath(albumId);
  const blob = await toBlob(dataUrl);
  const { error: upErr } = await supabase.storage
    .from("gallery")
    .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
  if (upErr) throw new Error(upErr.message);
  const { error } = await supabase
    .from("photos")
    .insert({ album_id: albumId, caption, storage_path: path });
  if (error) throw new Error(error.message);
}

export async function updatePhotoCaption(id: string, caption: string): Promise<void> {
  const { error } = await client().from("photos").update({ caption }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deletePhoto(id: string): Promise<void> {
  const supabase = client();
  const { data } = await supabase.from("photos").select("storage_path").eq("id", id).maybeSingle();
  const path = data ? str((data as Row).storage_path) : "";
  const { error } = await supabase.from("photos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (path) await supabase.storage.from("gallery").remove([path]);
}

/** Returns the storage path, which is what the donation row stores. */
export async function uploadProof(donationId: string, dataUrl: string): Promise<string> {
  const supabase = client();
  const path = objectPath(`proof/${donationId}`);
  const blob = await toBlob(dataUrl);
  const { error } = await supabase.storage
    .from("proofs")
    .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function removeProof(path: string): Promise<void> {
  await client().storage.from("proofs").remove([path]);
}

export async function uploadPaymentQr(
  label: string,
  dataUrl: string,
  activityId: string | null,
): Promise<void> {
  const supabase = client();
  const path = objectPath("qr");
  const blob = await toBlob(dataUrl);
  const { error: upErr } = await supabase.storage
    .from("qrcodes")
    .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
  if (upErr) throw new Error(upErr.message);
  const { error } = await supabase
    .from("payment_qrs")
    .insert({ label, storage_path: path, activity_id: activityId });
  if (error) throw new Error(error.message);
}

export async function deletePaymentQr(id: string, path: string): Promise<void> {
  const supabase = client();
  const { error } = await supabase.from("payment_qrs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (path) await supabase.storage.from("qrcodes").remove([path]);
}

/* ---------------------------------------------------------------- members */

export async function updateMember(id: string, patch: Partial<Member>): Promise<void> {
  const { error } = await client()
    .from("members")
    .update(
      clean({
        name: patch.name,
        email: patch.email,
        mobile: patch.mobile,
        wing: patch.wing,
        flat: patch.flat,
        role: patch.role,
        status: patch.status,
      }),
    )
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteMember(id: string): Promise<void> {
  const { error } = await client().from("members").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateSociety(patch: {
  name?: string;
  address?: string;
  wings?: string[];
  receiptPrefix?: string;
}): Promise<void> {
  const supabase = client();
  const { data } = await supabase.from("societies").select("id").limit(1).maybeSingle();
  const row = clean({
    name: patch.name,
    address: patch.address,
    wings: patch.wings,
    receipt_prefix: patch.receiptPrefix,
  });
  const { error } = data
    ? await supabase.from("societies").update(row).eq("id", str((data as Row).id))
    : await supabase.from("societies").insert(row);
  if (error) throw new Error(error.message);
}

/* --------------------------------------------------------------- realtime */

/**
 * Calls `onChange` whenever the money tables change, so a volunteer's entry
 * appears on the treasurer's phone without a refresh. Returns an unsubscribe.
 */
export function subscribeToChanges(onChange: () => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};
  const channel = supabase
    .channel("utsavkosh-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "donations" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "photos" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "albums" }, onChange)
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
