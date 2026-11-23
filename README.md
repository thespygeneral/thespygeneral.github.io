# Trade Journal: The Spy General

A free trading journal for The Spy General members. It handles stocks, options and futures.
Each member's trades are saved **only in their own browser, on their own computer**. There is no
server, no database, no accounts and no monthly cost.

## What members get

- Log trades by type. Stocks, options and futures each show only their own fields.
  - Stocks: ticker, long/short, shares, return %.
  - Options: underlying, bought/sold, call/put/spread, strike, expiration, multiplier.
  - Futures: pick ES, MES, NQ, MNQ, CL, GC and more. Point value and tick size fill in automatically.
- Scale in and out with multiple fills per trade. Average prices are worked out for you.
- Dashboard with net P&L, win rate, profit factor, average R, account-growth chart and
  breakdowns by type, symbol, weekday, strategy and tag.
- P&L calendar.
- Notes, tags, strategy, account, self-grade, stop/target and screenshots (paste, drag or upload).
- **Excel export** with Trades, Fills, Summary and Daily P&L tabs.
- **Protection:**
  - Optional passcode. The whole journal is then encrypted on the computer (AES-256-GCM,
    PBKDF2-SHA256 at 600,000 rounds, all in the browser's built-in Web Crypto).
  - A recovery code in case the passcode is forgotten.
  - Auto-lock after a set time away.
  - Backup files, locked with the passcode when one is set.
  - Automatic backup to a file in Chrome and Edge, plus reminders when a backup is overdue.
  - The browser is asked to never clear the site's data.
  - The built page carries a Content-Security-Policy with `connect-src 'none'`, so the browser
    itself blocks the page from sending data anywhere.
- Works offline and can be installed to the Dock or Home Screen.

## Day-to-day commands

```bash
npm install      # first time only
npm run dev      # local preview while editing, at http://localhost:5173
npm test         # money math, encryption and backup tests
npm run build    # makes the finished site in dist/
```

## Branding

Edit `src/config.ts`:

```ts
export const APP_NAME = "Trade Journal";
export const COMMUNITY_NAME = "Your Discord Name";
```

Also update the `<title>` in `index.html` and the `name` in `public/manifest.webmanifest`.

## Publishing (free, GitHub Pages)

The live site is **https://thespygeneral.github.io**. It's hosted by the separate `thespygeneral`
GitHub account, which isn't linked to any other business. Commits use GitHub's private noreply email.

To publish changes:

```bash
gh auth switch --user thespygeneral   # if another GitHub account is active
npm run deploy                        # runs the tests, builds, and publishes
```

The site files go to the `gh-pages` branch, and the source code goes to `main`. Hosting only serves
the same files to everyone. Members' trades never reach GitHub, so there's nothing to scale and no bill.

## Important: the website address must stay the same

Browsers keep each site's data under its web address. If the journal moves to a new address,
members' trades will **not** follow it automatically. They would need to download a backup on
the old address and open it on the new one. Pick the final address before announcing it.

## Project layout

- `src/lib/calc.ts`: P&L math for each type, plus stats.
- `src/lib/storage.ts`: saving to the browser, and turning the passcode on or off.
- `src/lib/crypto.ts`: encryption.
- `src/lib/backup.ts`: backup files and automatic backups.
- `src/lib/excel.ts`: Excel export.
- `src/lib/futures.ts`: futures contract specs.
- `src/pages/*`: the screens.
- `tests/*`: automated tests.
