import { amountInWords } from "@/lib/receipt";

/**
 * The society's printed Seva donation receipt.
 *
 * Follows the committee's existing paper design — gold rule, navy heading,
 * building crest — so a printed receipt is recognisably the same document
 * residents already receive. The difference is that the fields arrive filled in
 * rather than blank, which is the entire point of generating them from the
 * collection list.
 *
 * Sized in millimetres because these are printed, not scrolled.
 */

const NAVY = "#12357f";
const GOLD = "#c8a951";
const INK = "#3f3f46";

function Crest() {
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden>
      <defs>
        <clipPath id="crest-circle">
          <circle cx="60" cy="60" r="54" />
        </clipPath>
      </defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke={GOLD} strokeWidth="2.5" />
      <g clipPath="url(#crest-circle)">
        <rect x="6" y="6" width="108" height="108" fill="#cfe6f5" />
        {/* Towers */}
        <rect x="26" y="30" width="26" height="62" fill="#e8dcc4" stroke="#8a7a5c" strokeWidth="1.2" />
        <rect x="68" y="30" width="26" height="62" fill="#e8dcc4" stroke="#8a7a5c" strokeWidth="1.2" />
        {[0, 1, 2, 3, 4, 5].map((row) =>
          [0, 1, 2].map((col) => (
            <g key={`${row}-${col}`}>
              <rect x={30 + col * 7} y={36 + row * 9} width="4.5" height="5.5" fill="#6b5b3e" />
              <rect x={72 + col * 7} y={36 + row * 9} width="4.5" height="5.5" fill="#6b5b3e" />
            </g>
          )),
        )}
        {/* Glass atrium between them */}
        <path d="M60 52 L76 92 H44 Z" fill="#bcd9ee" stroke="#7d93a6" strokeWidth="1.2" />
        <path d="M60 52 V92 M52 72 H68" stroke="#7d93a6" strokeWidth="0.9" />
        {/* Lawn */}
        <rect x="6" y="92" width="108" height="22" fill="#7fb069" />
        {/* Palms */}
        {[18, 102].map((x) => (
          <g key={x}>
            <path d={`M${x} 92 q2 -14 0 -26`} stroke="#8a6b3f" strokeWidth="3" fill="none" />
            {[-1, 1].map((dir) => (
              <path
                key={dir}
                d={`M${x} 66 q${dir * 13} -5 ${dir * 17} 5`}
                stroke="#4f8f3a"
                strokeWidth="3.5"
                fill="none"
                strokeLinecap="round"
              />
            ))}
            <path d={`M${x} 66 q-4 -12 0 -16`} stroke="#4f8f3a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          </g>
        ))}
        {/* Shrubs */}
        <circle cx="34" cy="94" r="7" fill="#5f9e4a" />
        <circle cx="86" cy="94" r="7" fill="#5f9e4a" />
      </g>
    </svg>
  );
}

export interface SevaReceiptData {
  receiptNo: string;
  date: string;
  name: string;
  wing?: string;
  flat?: string;
  amount: number;
}

/** A single receipt, at fixed print dimensions. */
export function SevaReceipt({
  data,
  societyName,
  showWords = true,
}: {
  data: SevaReceiptData;
  societyName?: string;
  showWords?: boolean;
}) {
  const flatAndName = [
    [data.wing, data.flat].filter(Boolean).join("-"),
    data.name,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <article
      className="seva-receipt"
      style={{
        width: "180mm",
        height: "118mm",
        border: `1.2mm solid ${GOLD}`,
        padding: "7mm 9mm",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Masthead */}
      <header style={{ display: "flex", alignItems: "center", gap: "7mm" }}>
        <div style={{ width: "30mm", height: "30mm", flexShrink: 0 }}>
          <Crest />
        </div>
        <div style={{ minWidth: 0 }}>
          <h2
            style={{
              color: NAVY,
              fontSize: "9.5mm",
              lineHeight: 1.08,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            Festival / Community
            <br />
            Seva Donation Receipt
          </h2>
          {societyName ? (
            <p style={{ margin: "1.5mm 0 0", color: INK, fontSize: "3.6mm", fontWeight: 500 }}>
              {societyName}
            </p>
          ) : null}
        </div>
      </header>

      {/* Fields. The rule under each value keeps the look of the paper form. */}
      <div style={{ marginTop: "auto", paddingTop: "6mm" }}>
        <div style={{ display: "flex", gap: "10mm" }}>
          <Line label="Receipt No.:" value={data.receiptNo} width="52%" />
          <Line label="Date:" value={data.date} width="38%" />
        </div>
        <Line label="Flat No. and Name:" value={flatAndName} />
        <Line
          label="Amount: ₹"
          value={data.amount.toLocaleString("en-IN")}
          note={showWords ? amountInWords(data.amount) : undefined}
          strong
        />
      </div>

      <footer style={{ marginTop: "5mm", textAlign: "right" }}>
        <span style={{ color: INK, fontSize: "4.2mm" }}>Authorized Signature: </span>
        <span
          style={{
            display: "inline-block",
            width: "45mm",
            borderBottom: `0.4mm solid ${INK}`,
            marginLeft: "1mm",
          }}
        />
      </footer>
    </article>
  );
}

function Line({
  label,
  value,
  width,
  note,
  strong,
}: {
  label: string;
  value: string;
  width?: string;
  note?: string;
  strong?: boolean;
}) {
  return (
    <div style={{ width: width ?? "100%", marginTop: "4mm" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "2mm" }}>
        <span style={{ color: INK, fontSize: "5mm", whiteSpace: "nowrap" }}>{label}</span>
        <span
          style={{
            flex: 1,
            borderBottom: `0.4mm solid ${INK}`,
            paddingBottom: "0.8mm",
            color: "#111",
            fontSize: strong ? "6mm" : "5mm",
            fontWeight: strong ? 700 : 500,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {value}
        </span>
      </div>
      {note ? (
        <p style={{ margin: "1mm 0 0", color: INK, fontSize: "3.4mm", fontStyle: "italic" }}>
          {note}
        </p>
      ) : null}
    </div>
  );
}
