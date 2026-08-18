"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  clearAll,
  deletePhotoFile,
  putPhotoFile,
  readAllPhotoFiles,
  readState,
  writeState,
} from "./idb";
import { createSeedData } from "./seed";
import { DEFAULT_RECEIPT_PREFIX, nextReceiptNo } from "./receipt";
import type {
  Activity,
  Album,
  Donation,
  Expense,
  Member,
  PaymentQr,
  Photo,
  SocietyData,
} from "./types";

const SESSION_KEY = "society-app:session";

/**
 * The one place the app reads and writes society data.
 *
 * Everything is async and mutation-shaped (`addDonation`, `approveMember`, …)
 * rather than exposing raw state setters, so swapping the local IndexedDB
 * backing for Supabase means rewriting the bodies of these functions and
 * nothing in the screens.
 */
interface SocietyStore {
  /** False until persisted data has loaded; screens show a skeleton until then. */
  ready: boolean;
  data: SocietyData;
  session: Member | null;
  isAdmin: boolean;
  /** Admins and volunteers may both record collections. */
  canCollect: boolean;

  signIn(email: string, password: string): Promise<Result>;
  signUp(input: SignUpInput): Promise<Result>;
  signOut(): void;

  /** Resolves with the new entry's id, so the caller can go straight to its receipt. */
  addDonation(input: NewDonation): Promise<Result<string>>;
  updateDonation(id: string, patch: Partial<Donation>): Promise<Result>;
  deleteDonation(id: string): Promise<Result>;
  /** Treasurer confirms the cash or transfer actually reached the society. */
  verifyDonation(id: string): Promise<Result>;
  /** Undo a verification that was marked in error. */
  unverifyDonation(id: string): Promise<Result>;
  /** Confirm every pending entry from one volunteer at handover time. */
  verifyAllFrom(volunteerId: string, activityId?: string | null): Promise<Result<number>>;
  /** Records that the receipt has been sent, so the list can show what's left. */
  markReceiptSent(id: string): Promise<Result>;
  /**
   * Attaches the photograph of a paper receipt stub or a UPI confirmation
   * screenshot to an entry — the audit proof behind the money.
   */
  attachProof(id: string, file: File): Promise<Result>;
  removeProof(id: string): Promise<Result>;

  /** Upload one of the society's existing payment QR images. */
  addPaymentQr(label: string, file: File, activityId?: string | null): Promise<Result>;
  updatePaymentQr(id: string, patch: Partial<PaymentQr>): Promise<Result>;
  removePaymentQr(id: string): Promise<Result>;

  addExpense(input: NewExpense): Promise<Result>;
  updateExpense(id: string, patch: Partial<Expense>): Promise<Result>;
  deleteExpense(id: string): Promise<Result>;

  addActivity(input: NewActivity): Promise<Result>;
  updateActivity(id: string, patch: Partial<Activity>): Promise<Result>;
  deleteActivity(id: string): Promise<Result>;

  addAlbum(input: NewAlbum): Promise<Result<string>>;
  updateAlbum(id: string, patch: Partial<Album>): Promise<Result>;
  deleteAlbum(id: string): Promise<Result>;

  addPhotos(albumId: string, files: File[]): Promise<Result<number>>;
  updatePhoto(id: string, patch: Partial<Photo>): Promise<Result>;
  deletePhoto(id: string): Promise<Result>;

  approveMember(id: string): Promise<Result>;
  rejectMember(id: string): Promise<Result>;
  setMemberRole(id: string, role: Member["role"]): Promise<Result>;
  removeMember(id: string): Promise<Result>;

  updateSociety(patch: Partial<SocietyData["society"]>): Promise<Result>;
  /** Wipe everything and put the sample society back. */
  resetToSampleData(): Promise<void>;
  /** Wipe everything and start with an empty society. */
  startFresh(name: string, address: string, wings: string[]): Promise<Result>;
}

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: string): Result<never> => ({ ok: false, error });

export interface SignUpInput {
  name: string;
  email: string;
  mobile: string;
  wing: string;
  flat: string;
  password: string;
}

/**
 * `status` is decided by the store from the signer's role, and `receiptNo` is
 * issued by the store to keep the series gapless — neither is the caller's.
 */
export type NewDonation = Omit<
  Donation,
  | "id"
  | "createdAt"
  | "recordedBy"
  | "status"
  | "verifiedBy"
  | "verifiedAt"
  | "receiptNo"
  | "receiptSentAt"
>;
export type NewExpense = Omit<Expense, "id" | "createdAt" | "recordedBy">;
export type NewActivity = Omit<Activity, "id" | "createdAt">;
export type NewAlbum = Omit<Album, "id" | "createdAt">;

const SocietyContext = createContext<SocietyStore | null>(null);

const emptyData: SocietyData = {
  society: { name: "", address: "", wings: [] },
  members: [],
  activities: [],
  donations: [],
  expenses: [],
  albums: [],
  photos: [],
  paymentQrs: [],
};

function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

const nowIso = () => new Date().toISOString();

/**
 * Downscale and re-encode an upload before storing it. A 4 MB phone photo comes
 * out around 200 KB, which is what keeps a few hundred gallery images practical
 * — and is exactly what we'd do before uploading to Supabase Storage too.
 */
async function toStorableImage(file: File, maxDim = 1600, quality = 0.72): Promise<string> {
  const readAsDataUrl = () =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    // HEIC on an old browser, an SVG, a decode failure — store it as-is.
    return readAsDataUrl();
  }
}

/**
 * Image data is persisted separately, so it never goes into the state record.
 * Covers both gallery photographs and the proof images attached to donations.
 */
function stripImages(data: SocietyData): SocietyData {
  return {
    ...data,
    photos: data.photos.map((p) => ({ ...p, src: null })),
    donations: data.donations.map((d) => ({ ...d, proofSrc: null })),
    // `?? []` guards state persisted before payment QRs existed.
    paymentQrs: (data.paymentQrs ?? []).map((q) => ({ ...q, src: null })),
  };
}

function rehydrateImages(data: SocietyData, files: Record<string, string>): SocietyData {
  return {
    ...data,
    photos: data.photos.map((p) => ({ ...p, src: files[p.id] ?? null })),
    donations: data.donations.map((d) => ({
      ...d,
      proofSrc: d.proofPhotoId ? (files[d.proofPhotoId] ?? null) : null,
    })),
    paymentQrs: (data.paymentQrs ?? []).map((q) => ({ ...q, src: files[q.imageId] ?? null })),
  };
}

export function SocietyProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SocietyData>(emptyData);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  /** Suppresses the persist effect while the initial load is being applied. */
  const hydrating = useRef(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [stored, files] = await Promise.all([readState<SocietyData>(), readAllPhotoFiles()]);
      if (cancelled) return;
      setData(stored ? rehydrateImages(stored, files) : createSeedData());
      try {
        setSessionId(localStorage.getItem(SESSION_KEY));
      } catch {
        /* storage blocked — start signed out */
      }
      hydrating.current = false;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Live updates.
   *
   * In the demo this is a BroadcastChannel, so every open tab on this device
   * stays in step — enough to see the behaviour with two windows side by side.
   * With Supabase this becomes a Realtime subscription on the `donations` table
   * and the same effect keeps every resident's phone in step instead.
   *
   * A received update must not be re-broadcast, or two tabs would bounce the
   * same state between each other forever — `applyingRemote` breaks that cycle.
   * The tab that originated the change has already persisted it.
   */
  const channel = useRef<BroadcastChannel | null>(null);
  const applyingRemote = useRef(false);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("society-app:sync");
    channel.current = ch;
    ch.onmessage = (event: MessageEvent<SocietyData>) => {
      applyingRemote.current = true;
      // Image data isn't broadcast (far too large), so keep what this tab holds.
      setData((prev) => {
        const known: Record<string, string> = {};
        for (const p of prev.photos) if (p.src) known[p.id] = p.src;
        for (const d of prev.donations) if (d.proofPhotoId && d.proofSrc) known[d.proofPhotoId] = d.proofSrc;
        for (const q of prev.paymentQrs) if (q.src) known[q.imageId] = q.src;
        return rehydrateImages(event.data, known);
      });
    };
    return () => {
      ch.close();
      channel.current = null;
    };
  }, []);

  useEffect(() => {
    if (hydrating.current) return;
    if (applyingRemote.current) {
      applyingRemote.current = false;
      return;
    }
    const stripped = stripImages(data);
    void writeState(stripped);
    channel.current?.postMessage(stripped);
  }, [data]);

  const session = useMemo(
    () => data.members.find((m) => m.id === sessionId && m.status === "approved") ?? null,
    [data.members, sessionId],
  );

  const persistSession = useCallback((id: string | null) => {
    setSessionId(id);
    try {
      if (id) localStorage.setItem(SESSION_KEY, id);
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      /* session simply won't survive a reload */
    }
  }, []);

  /** Guards every write that only committee members may perform. */
  const requireAdmin = useCallback((): Result => {
    if (!session) return fail("Please sign in first.");
    if (session.role !== "admin") return fail("Only committee admins can make this change.");
    return ok(undefined);
  }, [session]);

  /** Guards collection entry, which volunteers may also do. */
  const requireVolunteer = useCallback((): Result => {
    if (!session) return fail("Please sign in first.");
    if (session.role === "resident") {
      return fail("Only committee admins and volunteers can record collections.");
    }
    return ok(undefined);
  }, [session]);

  const store = useMemo<SocietyStore>(() => {
    /** Applies `patch` to the item with `id` in one of the list-shaped fields. */
    function patchIn<K extends "donations" | "expenses" | "activities" | "albums" | "photos">(
      key: K,
      id: string,
      patch: Partial<SocietyData[K][number]>,
    ): Result {
      const guard = requireAdmin();
      if (!guard.ok) return guard;
      setData((prev) => ({
        ...prev,
        [key]: (prev[key] as Array<{ id: string }>).map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      }));
      return ok(undefined);
    }

    /**
     * A volunteer may correct or delete their own entry only while it is still
     * pending — once the treasurer has verified the handover, the entry is part
     * of the audited ledger and only an admin can touch it.
     */
    function mayAmendDonation(donation: Donation): Result {
      if (!session) return fail("Please sign in first.");
      if (session.role === "admin") return ok(undefined);
      if (session.role !== "volunteer") {
        return fail("Only committee admins and volunteers can change collections.");
      }
      if (donation.recordedBy !== session.id) {
        return fail("You can only change the entries you recorded yourself.");
      }
      if (donation.status === "verified") {
        return fail(
          "This entry has already been verified by the treasurer and is part of the ledger. Ask an admin to amend it.",
        );
      }
      return ok(undefined);
    }

    function removeFrom(
      key: "donations" | "expenses" | "activities",
      id: string,
    ): Result {
      const guard = requireAdmin();
      if (!guard.ok) return guard;
      setData((prev) => ({
        ...prev,
        [key]: (prev[key] as Array<{ id: string }>).filter((i) => i.id !== id),
      }));
      return ok(undefined);
    }

    return {
      ready,
      data,
      session,
      isAdmin: session?.role === "admin",
      canCollect: session?.role === "admin" || session?.role === "volunteer",

      async signIn(email, password) {
        const normalised = email.trim().toLowerCase();
        const member = data.members.find((m) => m.email.toLowerCase() === normalised);
        if (!member || member.password !== password) {
          return fail("That email and password don't match any account.");
        }
        // Only the committee and volunteers have logins; residents use the open
        // accounts, gallery and receipt pages instead.
        if (member.role === "resident") {
          return fail(
            "Residents don't need to sign in — the accounts, gallery and receipts are open to everyone. Use the links below.",
          );
        }
        if (member.status === "pending") {
          return fail(
            "Your account is waiting for committee approval. You'll be able to sign in once an admin approves it.",
          );
        }
        if (member.status === "rejected") {
          return fail("This account was not approved. Please contact the society office.");
        }
        persistSession(member.id);
        return ok(undefined);
      },

      async signUp(input) {
        const email = input.email.trim().toLowerCase();
        if (data.members.some((m) => m.email.toLowerCase() === email)) {
          return fail("An account with this email already exists. Try signing in instead.");
        }
        if (input.password.length < 6) {
          return fail("Please choose a password of at least 6 characters.");
        }
        const member: Member = {
          id: newId("mem"),
          name: input.name.trim(),
          email,
          mobile: input.mobile.trim(),
          wing: input.wing.trim().toUpperCase(),
          flat: input.flat.trim(),
          role: "resident",
          // Outsiders can't get in: an admin has to approve every new account.
          status: "pending",
          joinedAt: nowIso(),
          password: input.password,
        };
        setData((prev) => ({ ...prev, members: [...prev.members, member] }));
        return ok(undefined);
      },

      signOut() {
        persistSession(null);
      },

      async addDonation(input) {
        const guard = requireVolunteer();
        if (!guard.ok) return guard;
        if (!input.donorName.trim()) return fail("Please enter the donor's name.");
        if (!(input.amount > 0)) return fail("Amount must be more than zero.");
        const byAdmin = session!.role === "admin";
        const at = nowIso();
        const donation: Donation = {
          ...input,
          donorName: input.donorName.trim(),
          id: newId("don"),
          // Assigned once, here, so the series stays gapless and auditable.
          receiptNo: nextReceiptNo(
            data.donations,
            input.receivedAt,
            data.society.receiptPrefix || DEFAULT_RECEIPT_PREFIX,
          ),
          recordedBy: session!.id,
          // A volunteer's entry waits for handover; an admin recording it is
          // already the person holding the society's money.
          status: byAdmin ? "verified" : "pending",
          verifiedBy: byAdmin ? session!.id : undefined,
          verifiedAt: byAdmin ? at : undefined,
          createdAt: at,
        };
        setData((prev) => ({ ...prev, donations: [donation, ...prev.donations] }));
        return ok(donation.id);
      },

      async updateDonation(id, patch) {
        const existing = data.donations.find((d) => d.id === id);
        if (!existing) return fail("That entry no longer exists.");
        const guard = mayAmendDonation(existing);
        if (!guard.ok) return guard;
        // The receipt number is issued once and never reassigned — a resident
        // may already be holding a copy of it.
        const { receiptNo: _ignored, ...safe } = patch;
        void _ignored;
        setData((prev) => ({
          ...prev,
          donations: prev.donations.map((d) => (d.id === id ? { ...d, ...safe } : d)),
        }));
        return ok(undefined);
      },

      async attachProof(id, file) {
        const existing = data.donations.find((d) => d.id === id);
        if (!existing) return fail("That entry no longer exists.");
        const guard = mayAmendDonation(existing);
        if (!guard.ok) return guard;
        if (!file.type.startsWith("image/")) return fail("Please choose a photo or screenshot.");
        const photoId = existing.proofPhotoId ?? newId("proof");
        const src = await toStorableImage(file);
        await putPhotoFile(photoId, src);
        setData((prev) => ({
          ...prev,
          donations: prev.donations.map((d) =>
            d.id === id ? { ...d, proofPhotoId: photoId, proofSrc: src } : d,
          ),
        }));
        return ok(undefined);
      },

      async removeProof(id) {
        const existing = data.donations.find((d) => d.id === id);
        if (!existing) return fail("That entry no longer exists.");
        const guard = mayAmendDonation(existing);
        if (!guard.ok) return guard;
        if (existing.proofPhotoId) await deletePhotoFile(existing.proofPhotoId);
        setData((prev) => ({
          ...prev,
          donations: prev.donations.map((d) =>
            d.id === id ? { ...d, proofPhotoId: undefined, proofSrc: null } : d,
          ),
        }));
        return ok(undefined);
      },

      async addPaymentQr(label, file, activityId) {
        const guard = requireAdmin();
        if (!guard.ok) return guard;
        if (!label.trim()) return fail("Please label the QR so volunteers know which one it is.");
        if (!file.type.startsWith("image/")) return fail("Please choose the QR image.");
        const imageId = newId("qr");
        // A QR must stay sharp enough to scan off a phone screen, so this is
        // resized far less aggressively than a gallery photograph.
        const src = await toStorableImage(file, 1000, 0.92);
        await putPhotoFile(imageId, src);
        const qr: PaymentQr = {
          id: newId("pqr"),
          label: label.trim(),
          imageId,
          src,
          activityId: activityId ?? null,
          addedAt: nowIso(),
        };
        setData((prev) => ({ ...prev, paymentQrs: [...prev.paymentQrs, qr] }));
        return ok(undefined);
      },

      async updatePaymentQr(id, patch) {
        const guard = requireAdmin();
        if (!guard.ok) return guard;
        setData((prev) => ({
          ...prev,
          paymentQrs: prev.paymentQrs.map((q) => (q.id === id ? { ...q, ...patch } : q)),
        }));
        return ok(undefined);
      },

      async removePaymentQr(id) {
        const guard = requireAdmin();
        if (!guard.ok) return guard;
        const existing = data.paymentQrs.find((q) => q.id === id);
        if (existing) await deletePhotoFile(existing.imageId);
        setData((prev) => ({ ...prev, paymentQrs: prev.paymentQrs.filter((q) => q.id !== id) }));
        return ok(undefined);
      },

      async markReceiptSent(id) {
        const guard = requireVolunteer();
        if (!guard.ok) return guard;
        setData((prev) => ({
          ...prev,
          donations: prev.donations.map((d) =>
            d.id === id && !d.receiptSentAt ? { ...d, receiptSentAt: nowIso() } : d,
          ),
        }));
        return ok(undefined);
      },

      async deleteDonation(id) {
        const existing = data.donations.find((d) => d.id === id);
        if (!existing) return fail("That entry no longer exists.");
        const guard = mayAmendDonation(existing);
        if (!guard.ok) return guard;
        // Don't orphan the proof image in the blob store.
        if (existing.proofPhotoId) await deletePhotoFile(existing.proofPhotoId);
        setData((prev) => ({ ...prev, donations: prev.donations.filter((d) => d.id !== id) }));
        return ok(undefined);
      },

      async verifyDonation(id) {
        const guard = requireAdmin();
        if (!guard.ok) return guard;
        setData((prev) => ({
          ...prev,
          donations: prev.donations.map((d) =>
            d.id === id
              ? { ...d, status: "verified", verifiedBy: session!.id, verifiedAt: nowIso() }
              : d,
          ),
        }));
        return ok(undefined);
      },

      async unverifyDonation(id) {
        const guard = requireAdmin();
        if (!guard.ok) return guard;
        setData((prev) => ({
          ...prev,
          donations: prev.donations.map((d) =>
            d.id === id
              ? { ...d, status: "pending", verifiedBy: undefined, verifiedAt: undefined }
              : d,
          ),
        }));
        return ok(undefined);
      },

      async verifyAllFrom(volunteerId, activityId) {
        const guard = requireAdmin();
        if (!guard.ok) return guard;
        const matches = (d: Donation) =>
          d.recordedBy === volunteerId &&
          d.status === "pending" &&
          (activityId === undefined || d.activityId === activityId);
        const count = data.donations.filter(matches).length;
        if (!count) return fail("There's nothing pending from this volunteer.");
        const at = nowIso();
        setData((prev) => ({
          ...prev,
          donations: prev.donations.map((d) =>
            matches(d)
              ? { ...d, status: "verified", verifiedBy: session!.id, verifiedAt: at }
              : d,
          ),
        }));
        return ok(count);
      },

      async addExpense(input) {
        const guard = requireAdmin();
        if (!guard.ok) return guard;
        if (!input.title.trim()) return fail("Please describe what the money was spent on.");
        if (!(input.amount > 0)) return fail("Amount must be more than zero.");
        const expense: Expense = {
          ...input,
          title: input.title.trim(),
          id: newId("exp"),
          recordedBy: session!.id,
          createdAt: nowIso(),
        };
        setData((prev) => ({ ...prev, expenses: [expense, ...prev.expenses] }));
        return ok(undefined);
      },
      updateExpense: async (id, patch) => patchIn("expenses", id, patch),
      deleteExpense: async (id) => removeFrom("expenses", id),

      async addActivity(input) {
        const guard = requireAdmin();
        if (!guard.ok) return guard;
        if (!input.title.trim()) return fail("Please give the activity a name.");
        const activity: Activity = { ...input, id: newId("act"), createdAt: nowIso() };
        setData((prev) => ({ ...prev, activities: [...prev.activities, activity] }));
        return ok(undefined);
      },
      updateActivity: async (id, patch) => patchIn("activities", id, patch),
      async deleteActivity(id) {
        const guard = requireAdmin();
        if (!guard.ok) return guard;
        const linkedDonations = data.donations.filter((d) => d.activityId === id).length;
        const linkedExpenses = data.expenses.filter((e) => e.activityId === id).length;
        if (linkedDonations || linkedExpenses) {
          return fail(
            `This activity has ${linkedDonations} donation(s) and ${linkedExpenses} expense(s) recorded against it. ` +
              `Delete or reassign those entries first so the ledger stays correct.`,
          );
        }
        return removeFrom("activities", id);
      },

      async addAlbum(input) {
        const guard = requireAdmin();
        if (!guard.ok) return guard;
        if (!input.title.trim()) return fail("Please give the album a name.");
        const album: Album = { ...input, id: newId("alb"), createdAt: nowIso() };
        setData((prev) => ({ ...prev, albums: [album, ...prev.albums] }));
        return ok(album.id);
      },
      updateAlbum: async (id, patch) => patchIn("albums", id, patch),
      async deleteAlbum(id) {
        const guard = requireAdmin();
        if (!guard.ok) return guard;
        const doomed = data.photos.filter((p) => p.albumId === id);
        await Promise.all(doomed.map((p) => deletePhotoFile(p.id)));
        setData((prev) => ({
          ...prev,
          albums: prev.albums.filter((a) => a.id !== id),
          photos: prev.photos.filter((p) => p.albumId !== id),
        }));
        return ok(undefined);
      },

      async addPhotos(albumId, files) {
        const guard = requireAdmin();
        if (!guard.ok) return guard;
        const images = files.filter((f) => f.type.startsWith("image/"));
        if (!images.length) return fail("Please choose image files.");
        const added: Photo[] = [];
        for (const file of images) {
          const src = await toStorableImage(file);
          const photo: Photo = {
            id: newId("pho"),
            albumId,
            src,
            caption: "",
            uploadedAt: nowIso(),
          };
          await putPhotoFile(photo.id, src);
          added.push(photo);
        }
        setData((prev) => ({ ...prev, photos: [...prev.photos, ...added] }));
        return ok(added.length);
      },
      updatePhoto: async (id, patch) => patchIn("photos", id, patch),
      async deletePhoto(id) {
        const guard = requireAdmin();
        if (!guard.ok) return guard;
        await deletePhotoFile(id);
        setData((prev) => ({ ...prev, photos: prev.photos.filter((p) => p.id !== id) }));
        return ok(undefined);
      },

      approveMember: async (id) => patchMember(id, { status: "approved" }),
      rejectMember: async (id) => patchMember(id, { status: "rejected" }),
      setMemberRole: async (id, role) => patchMember(id, { role }),
      async removeMember(id) {
        const guard = requireAdmin();
        if (!guard.ok) return guard;
        if (id === session!.id) return fail("You can't remove your own account.");
        setData((prev) => ({ ...prev, members: prev.members.filter((m) => m.id !== id) }));
        return ok(undefined);
      },

      async updateSociety(patch) {
        const guard = requireAdmin();
        if (!guard.ok) return guard;
        setData((prev) => ({ ...prev, society: { ...prev.society, ...patch } }));
        return ok(undefined);
      },

      async resetToSampleData() {
        await clearAll();
        persistSession(null);
        setData(createSeedData());
      },

      async startFresh(name, address, wings) {
        if (!name.trim()) return fail("Please enter your society's name.");
        const admin = session;
        if (!admin) return fail("Please sign in first.");
        await clearAll();
        setData({
          society: { name: name.trim(), address: address.trim(), wings },
          // The signed-in admin is carried over, otherwise nobody could get back in.
          members: [{ ...admin, role: "admin", status: "approved" }],
          activities: [],
          donations: [],
          expenses: [],
          albums: [],
          photos: [],
          paymentQrs: [],
        });
        return ok(undefined);
      },
    };

    function patchMember(id: string, patch: Partial<Member>): Result {
      const guard = requireAdmin();
      if (!guard.ok) return guard;
      if (id === session!.id && patch.role === "resident") {
        return fail("You can't remove your own admin rights — ask another admin to do it.");
      }
      setData((prev) => ({
        ...prev,
        members: prev.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      }));
      return ok(undefined);
    }
  }, [data, ready, session, requireAdmin, requireVolunteer, persistSession]);

  return <SocietyContext.Provider value={store}>{children}</SocietyContext.Provider>;
}

export function useSociety(): SocietyStore {
  const store = useContext(SocietyContext);
  if (!store) throw new Error("useSociety must be used inside <SocietyProvider>");
  return store;
}

/** Look-ups the screens need constantly. */
export function useLookups() {
  const { data } = useSociety();
  return useMemo(
    () => ({
      activityById: new Map(data.activities.map((a) => [a.id, a])),
      memberById: new Map(data.members.map((m) => [m.id, m])),
      albumByActivityId: new Map(
        data.albums.filter((a) => a.activityId).map((a) => [a.activityId!, a]),
      ),
      photosByAlbumId: data.photos.reduce<Map<string, Photo[]>>((map, p) => {
        const list = map.get(p.albumId) ?? [];
        list.push(p);
        map.set(p.albumId, list);
        return map;
      }, new Map()),
    }),
    [data],
  );
}
