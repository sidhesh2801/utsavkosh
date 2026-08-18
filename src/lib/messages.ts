import type { ActivityFinance, FundSummary } from "./finance";
import { dateTime, money, relativeDays, shortDate } from "./format";
import type { Activity, Album, SocietyData } from "./types";

/**
 * Ready-made WhatsApp messages.
 *
 * WhatsApp's official API cannot post to groups, and the libraries that fake it
 * get phone numbers banned — so instead the app composes the message and hands
 * it to WhatsApp for the admin to send into the society group with one tap.
 * WhatsApp markup: *bold*, _italic_.
 */

/** Trailing link line, omitted until the app is actually deployed somewhere. */
function linkLine(url?: string): string {
  return url ? `\n\nFull details & photos:\n${url}` : "";
}

export function activityUpdateMessage(
  society: SocietyData["society"],
  activity: Activity,
  fin: ActivityFinance,
  url?: string,
): string {
  const when =
    activity.status === "completed"
      ? shortDate(activity.startsAt)
      : `${dateTime(activity.startsAt)} (${relativeDays(activity.startsAt)})`;

  const lines = [
    `🪔 *${activity.title}*`,
    `_${society.name}_`,
    ``,
    `📅 ${when}`,
    `📍 ${activity.venue}`,
    ``,
    `*Fund position*`,
    `Collected: ${money(fin.collected)}${
      fin.pendingCollection > 0 ? ` (+ ${money(fin.pendingCollection)} awaiting handover)` : ""
    }`,
    `Spent so far: ${money(fin.spent)}`,
    `Balance in hand: ${money(fin.balance)}`,
    `Approved budget: ${money(fin.budget)}`,
    ``,
    `🙏 ${fin.donorCount} ${fin.donorCount === 1 ? "family has" : "families have"} contributed so far.`,
  ];
  if (fin.collected < fin.budget && activity.status !== "completed") {
    lines.push(`Still short of the budget by ${money(fin.budget - fin.collected)} — do pitch in.`);
  }
  return lines.join("\n") + linkLine(url);
}

export function activityInviteMessage(
  society: SocietyData["society"],
  activity: Activity,
  url?: string,
): string {
  return (
    [
      `🎉 *${activity.title}*`,
      `_${society.name}_`,
      ``,
      `📅 ${dateTime(activity.startsAt)}`,
      `📍 ${activity.venue}`,
      ``,
      activity.description,
      ``,
      `Organised by the ${activity.organiser}. All residents are warmly invited 🙏`,
    ].join("\n") + linkLine(url)
  );
}

export function fundSummaryMessage(
  society: SocietyData["society"],
  summary: FundSummary,
  url?: string,
): string {
  return (
    [
      `📊 *Society fund statement*`,
      `_${society.name}_`,
      `As on ${shortDate(new Date().toISOString())}`,
      ``,
      `Total collected: ${money(summary.collected)}`,
      `Total spent: ${money(summary.spent)}`,
      `*Balance in hand: ${money(summary.balance)}*`,
      ``,
      `From ${summary.donorCount} contributing families across ${summary.donationCount} entries.`,
      summary.pendingCollection > 0
        ? `\n⏳ ${money(summary.pendingCollection)} recorded by volunteers is still awaiting handover to the treasurer, and is not counted in the balance above.`
        : ``,
      ``,
      `Every entry above is itemised in the app, with the vendor and bill number against each expense. Residents are welcome to check and question anything.`,
    ]
      .filter((l) => l !== undefined)
      .join("\n") + linkLine(url)
  );
}

export function collectionRequestMessage(
  society: SocietyData["society"],
  activity: Activity,
  fin: ActivityFinance,
  volunteerNames: string[],
  url?: string,
): string {
  return (
    [
      `🙏 *${activity.title} — contributions open*`,
      `_${society.name}_`,
      ``,
      `📅 ${dateTime(activity.startsAt)}`,
      `Budget approved by the committee: ${money(fin.budget)}`,
      `Collected so far: ${money(fin.pledged)} (${fin.fundedPct}%)`,
      ``,
      `*How to contribute*`,
      `• Hand cash to any of our volunteers: ${volunteerNames.join(", ")}`,
      `• Or pay by UPI and share the reference with them`,
      ``,
      `Every contribution is entered in the app the moment it is received, and every rupee spent is listed with its bill. Do have a look 👇`,
    ].join("\n") + linkLine(url)
  );
}

export function albumMessage(
  society: SocietyData["society"],
  album: Album,
  photoCount: number,
  url?: string,
): string {
  return (
    [
      `📸 *${album.title} — photos are up*`,
      `_${society.name}_`,
      ``,
      `${photoCount} ${photoCount === 1 ? "photo" : "photos"} from ${shortDate(album.date)}.`,
      album.description ? `\n${album.description}` : ``,
    ]
      .filter(Boolean)
      .join("\n") + linkLine(url)
  );
}

/** Handover reminder for a volunteer sitting on collected cash. */
export function handoverReminderMessage(
  volunteerName: string,
  amount: number,
  count: number,
  activityTitle: string,
): string {
  return [
    `Hello ${volunteerName} 🙏`,
    ``,
    `Our records show ${money(amount)} from ${count} ${count === 1 ? "flat" : "flats"} collected by you for *${activityTitle}*, pending handover to the treasurer.`,
    ``,
    `Could you please hand it over at your convenience so the accounts stay current? Thank you for helping with the collections.`,
  ].join("\n");
}
