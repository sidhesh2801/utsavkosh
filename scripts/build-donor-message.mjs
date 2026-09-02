#!/usr/bin/env node
/**
 * Rebuilds the two things residents actually see, from the live register:
 *
 *   ~/Downloads/whatsapp_message_marathi_hindi_english.txt
 *   ~/Downloads/anonymous_qr_donations.csv
 *
 *   node --env-file=.env.local scripts/build-donor-message.mjs
 *
 * Generated rather than edited by hand because it is written three times over
 * — Marathi, Hindi, English — and a list retyped in three languages is a list
 * that disagrees with itself by the third. The database is the single source;
 * this only formats it.
 *
 * The QR entries carry no name and that is not a defect in this script: a QR
 * payment reaches the society as one settlement for the day rather than a list
 * of who paid, whatever app the resident used, so neither the bank nor the
 * merchant export names them. They are listed by amount, date and the
 * last four digits of the transaction id, which is enough for a resident to
 * recognise their own payment and claim it. The CSV is the committee's side of
 * that conversation — one row per unnamed payment, waiting for a name.
 *
 * Standalone, like the importer: outside src/, no dependencies beyond Node and
 * supabase-js, nothing in the app imports it.
 */

import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Run with:  node --env-file=.env.local scripts/build-donor-message.mjs");
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });

const money = (n) => "₹" + Number(n).toLocaleString("en-IN");
const dayMonth = (iso) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}`;

/** A PhonePe id is T + YYMMDD + HHMMSS + digits; a bank RRN is 12 digits. */
const isPhonePeId = (ref) => /^T\d{12}/.test(String(ref ?? ""));
const timeFromId = (ref) =>
  isPhonePeId(ref) ? `${String(ref).slice(7, 9)}:${String(ref).slice(9, 11)}` : "";

const { data, error } = await db
  .from("donations")
  .select("donor_name, wing, flat, amount, received_at, reference, receipt_no")
  .order("received_at")
  .order("created_at");

if (error) {
  console.error(error.message);
  process.exit(1);
}

const isQr = (d) => String(d.donor_name).includes("QR");
const named = data.filter((d) => !isQr(d));
const anon = data.filter(isQr);
const total = (rows) => rows.reduce((t, r) => t + Number(r.amount), 0);

/* ------------------------------------------- the committee's claim sheet */

const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const csv = [
  // The four trailing columns are blank on purpose: this sheet is filled in
  // as residents come forward, and it doubles as the record of who is still
  // owed a receipt.
  ["S.No", "Date", "Time", "Amount (Rs.)", "Transaction ID", "Last 4", "Reference type",
   "Receipt No", "Name", "Flat No", "Mobile", "Receipt given?"],
  ...anon.map((d, i) => [
    i + 1,
    d.received_at,
    timeFromId(d.reference),
    Number(d.amount).toFixed(2),
    d.reference ?? "",
    String(d.reference ?? "").slice(-4),
    // Says where to look the payment up, not which file it arrived in: one of
    // the older rows already carried a PhonePe id rather than a bank RRN.
    isPhonePeId(d.reference) ? "PhonePe txn ID" : "Bank UPI RRN",
    d.receipt_no ?? "",
    "", "", "", "",
  ]),
];

const csvPath = join(homedir(), "Downloads", "anonymous_qr_donations.csv");
writeFileSync(csvPath, csv.map((r) => r.map(csvCell).join(",")).join("\n") + "\n");

/* ------------------------------------------------------ the WhatsApp list */

const L = [];
const p = (...lines) => L.push(...lines);

p(
  "🙏 *श्री कृष्ण जन्माष्टमी उत्सव – देणगीदारांची यादी* 🙏",
  "🙏 *श्री कृष्ण जन्माष्टमी उत्सव – दानदाताओं की सूची* 🙏",
  "🙏 *Shri Krishna Janmashtami Utsav – List of Donors* 🙏",
  "",
  "सर्व देणगीदारांचे मनःपूर्वक आभार 🙏",
  "आपल्या सहकार्यामुळे आमच्या श्री कृष्ण जन्माष्टमी उत्सवाच्या आयोजनात खूप मदत होत आहे.",
  "आतापर्यंत प्राप्त झालेल्या देणग्यांची यादी खाली दिली आहे:",
  "",
  "सभी दानदाताओं का हृदय से धन्यवाद 🙏",
  "आपके सहयोग से हमारे श्री कृष्ण जन्माष्टमी उत्सव के आयोजन में बहुत मदद मिल रही है।",
  "नीचे अब तक प्राप्त दान की सूची है:",
  "",
  "Heartfelt thanks to all our donors 🙏",
  "Your support is helping us a great deal in organising our Shri Krishna Janmashtami Utsav.",
  "The list of donations received so far is given below:",
  "",
);

named.forEach((d, i) => {
  const flat = [d.wing, d.flat].filter(Boolean).join("-");
  p(`${i + 1}. ${d.donor_name}${flat ? ` (${flat})` : ""} – ${money(d.amount)}`);
});

p(
  "",
  "🙏 *विशेष सूचना – QR द्वारे प्राप्त देणग्या*",
  "QR स्कॅन करून केलेल्या देणग्या सोसायटीला दिवसभराच्या एकत्रित रकमेच्या स्वरूपात मिळतात — पैसे कोणत्याही ॲपवरून पाठवले असले तरी देणगीदाराचे नाव कळत नाही, फक्त ट्रान्झॅक्शन ID मिळते. त्यामुळे खालील नोंदी नावाशिवाय आहेत. ही कोणाचीही उपेक्षा नाही 🙏",
  "आपली *पावती लगेच डाउनलोड करता येते* — देणगी यादीत आपली नोंद शोधा आणि त्या ओळीवरील *Receipt* वर टॅप करा. आपले नाव यादीत यावे असे वाटत असल्यास, आपली रक्कम, तारीख आणि ट्रान्झॅक्शन ID सोबत *नाव व फ्लॅट क्रमांक* आम्हाला WhatsApp करा.",
  '_(ट्रान्झॅक्शन ID आपल्या PhonePe / GPay / बँक ॲपमध्ये "UPI transaction ID" किंवा "UTR" या नावाने दिसते.)_',
  "",
  "🙏 *विशेष सूचना – QR से प्राप्त दान*",
  "QR स्कैन करके किए गए दान सोसायटी को दिनभर की एकमुश्त राशि के रूप में मिलते हैं — पैसे किसी भी ऐप से भेजे हों, दानदाता का नाम नहीं आता, केवल ट्रांज़ैक्शन ID मिलती है। इसीलिए नीचे की प्रविष्टियाँ बिना नाम के हैं। यह किसी की अनदेखी नहीं है 🙏",
  "आपकी *रसीद तुरंत डाउनलोड की जा सकती है* — दान सूची में अपनी प्रविष्टि ढूँढ़ें और उस पंक्ति पर *Receipt* दबाएँ। यदि आप चाहते हैं कि सूची में आपका नाम आए, तो अपनी राशि, तारीख और ट्रांज़ैक्शन ID के साथ *नाम व फ्लैट नंबर* हमें WhatsApp करें।",
  '_(ट्रांज़ैक्शन ID आपकी PhonePe / GPay / बैंक ऐप में "UPI transaction ID" या "UTR" के नाम से दिखती है।)_',
  "",
  "🙏 *Special Notice – Donations received by QR*",
  "Donations made by scanning the QR reach the society as a single settlement for the day rather than as a list of who paid — whichever app the money was sent from, only a transaction ID comes through. That is why the entries below appear without names. No one is being overlooked 🙏",
  "You can *download your receipt straight away* — find your entry in the donations list and tap *Receipt* on that row. If you would also like your name on the list, WhatsApp us your *name and flat number* along with the amount, date and transaction ID.",
  '_(The transaction ID appears in your PhonePe / GPay / bank app as "UPI transaction ID" or "UTR".)_',
  "",
  // One line for all three languages: a URL reads the same in each, and
  // repeating it three times is three chances to mistype it.
  "🧾 देणगी यादी / दान सूची / Donations list:",
  "https://utsav-reciept-generator.vercel.app/donations",
  "",
);

anon.forEach((d, i) => {
  p(
    `${named.length + i + 1}. ${money(d.amount)} – ${dayMonth(d.received_at)} | …${String(
      d.reference ?? "",
    ).slice(-4)}`,
  );
});

p(
  "",
  `नावासह देणगी / नामसहित दान / Donations with names: *${money(total(named))}* (${named.length})`,
  `QR देणगी / QR दान / QR donations: *${money(total(anon))}* (${anon.length})`,
  `आतापर्यंत एकूण प्राप्त देणगी / अब तक कुल प्राप्त दान / Total received so far: *${money(total(data))}*`,
  "",
  "🙏 सर्व देणगीदारांचे खूप खूप आभार.",
  "आपले सहकार्य आमचा उत्सव यशस्वी करण्यात महत्त्वाचे योगदान आहे. 🌸🦚",
  "",
  "🙏 सभी दानदाताओं का बहुत-बहुत धन्यवाद।",
  "आपका सहयोग हमारे उत्सव को सफल बनाने में महत्वपूर्ण योगदान है। 🌸🦚",
  "",
  "🙏 Many thanks to all our donors.",
  "Your support is a valuable contribution towards making our festival a success. 🌸🦚",
  "",
  "_सूचना: फ्लॅट क्रमांक फक्त तेथेच दिले आहेत जेथे तपशिलात उपलब्ध होते._",
  "_नोट: फ्लैट नंबर केवल वहीं दिए गए हैं जहाँ विवरण में उपलब्ध थे।_",
  "_Note: Flat numbers are mentioned only where provided in the statement/list._",
  "_जर आपले नाव या यादीत नसेल, तर कृपया पुढील अद्ययावत यादीची प्रतीक्षा करा._",
  "_यदि आपका नाम इस सूची में नहीं है, तो कृपया अगली अपडेटेड सूची की प्रतीक्षा करें।_",
  "_If your name does not appear in this list, please wait for the updated list._",
);

const txtPath = join(homedir(), "Downloads", "whatsapp_message_marathi_hindi_english.txt");
writeFileSync(txtPath, L.join("\n") + "\n");

console.log(`  named        ${String(named.length).padStart(3)}   ${money(total(named))}`);
console.log(`  anonymous QR ${String(anon.length).padStart(3)}   ${money(total(anon))}`);
console.log(`  total        ${String(data.length).padStart(3)}   ${money(total(data))}`);
console.log(`\n  ${txtPath}`);
console.log(`  ${csvPath}`);
