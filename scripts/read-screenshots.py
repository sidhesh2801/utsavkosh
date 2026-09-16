#!/usr/bin/env python3
"""
Turns OCR'd PhonePe screenshots into the UTR-and-name lines name-donors.mjs
wants.

    swiftc -O scripts/ocr-screenshots.swift -o /tmp/ocr
    /tmp/ocr reciept-ss/*.jpeg > /tmp/raw.txt
    python3 scripts/read-screenshots.py /tmp/raw.txt > /tmp/names.txt

The app prints a payment as two lines — "09:34PM • Purva Sabale" then
"UTR: 722024011202 | QR" — so a name is whatever sat above the UTR. Rows whose
payer is masked (`******9611`, how the PhonePe app shows it) carry no name and
are counted, not guessed at.
"""

import re
import sys

# A leading bullet or stray character before the time is common in the OCR
# output, and requiring the line to start with the time lost a donor to it.
TIME = re.compile(r"^[\s•·\-|]*(\d{1,2}:\d{2}\s*[AP]M)\s*[•·\-|]?\s*(.+)$", re.I)
UTR = re.compile(r"UTR[:\s]*([0-9]{12})")

pending, pairs, masked = None, [], 0

for line in open(sys.argv[1], encoding="utf-8"):
    line = line.strip()
    if m := TIME.match(line):
        pending = m.group(2).strip()
        continue
    if (u := UTR.search(line)) and pending:
        name = re.sub(r"[.…]{2,}$", "", pending).strip(" .|•·-")
        if re.fullmatch(r"[\*x\s\d]+", name) or name.count("*") >= 3:
            masked += 1
        else:
            pairs.append((u.group(1), name))
        pending = None

seen = {}
for utr, name in pairs:
    seen.setdefault(utr, name)

for utr, name in seen.items():
    print(f"{utr}  {name}")

print(
    f"# {len(seen)} payments with a name, {masked} masked (no name to read)",
    file=sys.stderr,
)
