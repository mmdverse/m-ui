#!/usr/bin/env python3
"""سازندهٔ کارت‌های حمایت مالی (SVG).

هر کارت: نشانِ زنجیره + نام + شبکه + آدرس + QR واقعی (قابل اسکن با کیف پول).
QR با segno ساخته می‌شود و به‌صورت path در SVG می‌نشیند تا تصویر کاملاً
خودبسنده باشد (بدون فونت و بدون منبع بیرونی).

اجرا:  pip install segno && python3 docs/assets/donate/build.py
"""
from __future__ import annotations

import pathlib

import segno

OUT = pathlib.Path(__file__).resolve().parent

W, H = 900, 220
BG = "#0a0a0b"
PANEL = "#111113"
BORDER = "#ffffff"
TXT = "#f5f5f5"
MUTED = "#8b8b93"
DIM = "#6b6b73"
ADDR = "#e5e5e5"

CHAINS = [
    {
        "slug": "bitcoin",
        "name": "Bitcoin",
        "network": "BTC · mainnet",
        "address": "bc1q36uzqlkaav3lkscknhemcem0lcjtkhepdqckul",
        "accent": "#F7931A",
        "note": "Native SegWit (bech32) — lowest fees of the four.",
    },
    {
        "slug": "bnb",
        "name": "BNB Smart Chain",
        "network": "BEP-20 · BSC",
        "address": "0x57902d3955D5F1C0fbCaEA0a12A7D691c792487E",
        "accent": "#F0B90B",
        "note": "Any EVM wallet works: MetaMask, Trust, Binance.",
    },
    {
        "slug": "solana",
        "name": "Solana",
        "network": "SOL · mainnet",
        "address": "4hCYetZjvK8mkuobRvPYXyRnM84aTj3q8LZ1GpiTK8HR",
        "accent": "#14F195",
        "note": "Fees are fractions of a cent.",
    },
    {
        "slug": "tron",
        "name": "Tron",
        "network": "TRC-20 · TRON",
        "address": "TVFZKSwMYNw1jiCyKKtKoVG3HbpB4DhsA5",
        "accent": "#EF0027",
        "note": "Cheapest way to send USDT to this project.",
    },
]


# ── نشانه‌های زنجیره‌ها (هندسهٔ دست‌ساز، ۴۸×۴۸، مونوکروم با لهجهٔ رنگی) ──────────

def mark_bitcoin(c: str) -> str:
    return f"""    <circle cx="24" cy="24" r="19" fill="none" stroke="{c}" stroke-width="2.4"/>
    <g fill="none" stroke="{c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 14V34"/>
      <path d="M26 10.5V14"/>
      <path d="M26 34V37.5"/>
      <path d="M21 15h6a4.5 4.5 0 0 1 0 9h-6"/>
      <path d="M21 24h7a5 5 0 0 1 0 10h-7"/>
    </g>"""


def mark_bnb(c: str) -> str:
    def diamond(cx: float, cy: float, r: float = 5.2) -> str:
        return f'M{cx} {cy - r}L{cx + r} {cy}L{cx} {cy + r}L{cx - r} {cy}Z'

    parts = [diamond(24, 24), diamond(24, 14.4), diamond(24, 33.6), diamond(14.4, 24), diamond(33.6, 24)]
    return '    <path fill="%s" d="%s"/>' % (c, ''.join(parts))


def mark_solana(c: str) -> str:
    # سه میلهٔ موازی با شیب یکسان؛ میلهٔ میانی به راست جابه‌جا شده.
    bar = 'M13 {y}H35L31 {y2}H9Z'
    return (
        f'    <path fill="{c}" d="{bar.format(y=11.5, y2=16.5)}"/>'
        f'<path fill="{c}" d="{bar.format(y=21.0, y2=26.0).replace("M13 21.0H35L31 26.0H9", "M17 21H39L35 26H13")}"/>'
        f'<path fill="{c}" d="{bar.format(y=30.5, y2=35.5)}"/>'
    )


def mark_tron(c: str) -> str:
    return f"""    <path fill="none" stroke="{c}" stroke-width="2.2" stroke-linejoin="round"
          d="M10.5 11.5 38 15.5 22.5 38.5Z"/>
    <g fill="none" stroke="{c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16.5 19.5 31.5 21.5"/>
      <path d="M24.5 20.7 22.7 33.5"/>
    </g>"""


MARKS = {
    "bitcoin": mark_bitcoin,
    "bnb": mark_bnb,
    "solana": mark_solana,
    "tron": mark_tron,
}


# ── QR ────────────────────────────────────────────────────────────────────────

def qr_path(data: str, x: float, y: float, module: float) -> tuple[str, float]:
    qr = segno.make(data, error="m")
    matrix = qr.matrix
    n = len(matrix)
    parts = []
    for r, row in enumerate(matrix):
        col = 0
        while col < n:
            if row[col]:
                start = col
                while col < n and row[col]:
                    col += 1
                parts.append(f"M{x + start * module:.2f} {y + r * module:.2f}h{(col - start) * module:.2f}v{module:.2f}h-{(col - start) * module:.2f}z")
            else:
                col += 1
    return "".join(parts), n * module


def card(ch: dict) -> str:
    tile = 156.0          # قاب سفید QR
    tx, ty = 708.0, 32.0
    module = 4.0
    qr, qr_size = qr_path(ch["address"], 0, 0, module)
    qx = tx + (tile - qr_size) / 2
    qy = ty + (tile - qr_size) / 2
    accent = ch["accent"]
    # ستون چپ: قاب نشان + نام + شبکه + آدرس + یادداشت (۱۶ پیکسل بالاتر از قبل، تا
    # بلوک نسبت به کارت وسط‌چین شود)
    bx, by = 36.0, 56.0

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img"
     aria-label="{ch['name']} ({ch['network']}) donation address: {ch['address']}">
  <defs>
    <linearGradient id="edge-{ch['slug']}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{accent}" stop-opacity="0.95"/>
      <stop offset="1" stop-color="{accent}" stop-opacity="0.25"/>
    </linearGradient>
    <pattern id="grid-{ch['slug']}" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0v40" fill="none" stroke="#ffffff" stroke-opacity="0.03" stroke-width="1"/>
    </pattern>
  </defs>

  <rect width="{W}" height="{H}" rx="16" fill="{BG}"/>
  <rect width="{W}" height="{H}" rx="16" fill="url(#grid-{ch['slug']})"/>
  <rect x="0.5" y="0.5" width="{W - 1}" height="{H - 1}" rx="15.5" fill="none" stroke="{BORDER}" stroke-opacity="0.10"/>
  <path d="M8 0h6a6 6 0 0 0-6 6z" fill="none"/>
  <rect x="0" y="0" width="3" height="{H}" rx="1.5" fill="url(#edge-{ch['slug']})"/>

  <!-- نشان زنجیره -->
  <rect x="{bx}" y="{by}" width="96" height="96" rx="24" fill="{PANEL}" stroke="{BORDER}" stroke-opacity="0.12"/>
  <g transform="translate({bx + 24} {by + 24})">
    <g transform="scale(1.75)">
{MARKS[ch['slug']](accent)}
    </g>
  </g>

  <!-- نام و شبکه -->
  <text x="160" y="{by + 26}" font-family="ui-sans-serif,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
        font-size="23" font-weight="600" fill="{TXT}" letter-spacing="0.2">{ch['name']}</text>
  <text x="160" y="{by + 52}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"
        font-size="13" fill="{MUTED}" letter-spacing="1.6">{ch['network'].upper()}</text>

  <!-- آدرس -->
  <text x="160" y="{by + 94}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"
        font-size="17.5" fill="{ADDR}" letter-spacing="0.4">{ch['address']}</text>

  <!-- QR -->
  <rect x="{tx}" y="{ty}" width="{tile}" height="{tile}" rx="14" fill="#ffffff"/>
  <path transform="translate({qx:.2f} {qy:.2f})" fill="#0a0a0b" d="{qr}"/>

  <text x="160" y="{by + 122}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"
        font-size="12" fill="{DIM}">{ch['note']}</text>
</svg>
"""


def main() -> None:
    for ch in CHAINS:
        path = OUT / f"donate-{ch['slug']}.svg"
        path.write_text(card(ch), encoding="utf-8")
        print("wrote", path.relative_to(OUT.parent.parent.parent))


if __name__ == "__main__":
    main()
