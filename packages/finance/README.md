# Exchange portfolios

This package separates finance models and exact arithmetic from provider I/O.
The browser imports `@actual-app/finance`. Server integrations import the
Node-only `@actual-app/finance/server` export. No credentials belong in source
code, fixtures, browser storage, or budget preferences.

## Use in Actual

Open **Exchanges** below accounts in the sidebar, or select an individual exchange to view its holdings and activity. **Bank Sync → Exchange portfolio** also opens the portfolio. Add a connection using a read-only
API key (and the separate API passphrase for Bitget). Set the earliest history
date and, for Binance, any historically traded symbols that cannot be discovered
from current holdings. Save, then select **Sync exchanges**.

Each connection has independent collection settings and coverage. The sync
server collects enabled connections while browsers are closed. The browser
copies the latest portfolio into the budget's device-sync stream for offline reading, protected by budget encryption
when enabled. Server collection and budget-cache refresh are separate: open
the portfolio or select **Refresh saved data** to obtain the latest collection.
The sidebar and portfolio also poll saved server data every minute while open.

In **Connections**, edit **Refresh interval in minutes** and select **Save
schedule**. The default is 15 minutes; supported intervals are 5–1,440 minutes
(at least daily). Previously saved intervals longer than a day are treated as
daily. Pause/resume is explicit and keeps the saved interval. Each connection
shows its last successful sync and next due attempt. The server checks due
connections immediately on startup and once per minute thereafter, with leases
to prevent concurrent collection. A stopped/sleeping server cannot collect;
overdue work resumes when it starts. Outages retain previous observations and
show an error; retries use the configured interval. Keep the local server
running for unattended updates.

Every collection saves a durable encrypted holdings/positions checkpoint.
Market and FX quotes retain their source and timestamp instead of replacing
older rates. **Changes** compares native net units, ZAR rates, and holding
values against the latest checkpoint at or before one day before the valuation
date. It includes exited assets and shows actual observation dates. Missing
checkpoints/rates are unavailable, and stale or incomplete observations are
flagged. Value changes include transfers, trades, liabilities, and price moves;
they are not investment returns. The comparison is cached for offline use.
Use **Valuation date → View history** to inspect earlier saved checkpoints;
dates preceding collected or imported evidence may be unavailable.

**Graphs** plots priced portfolio value and selectable asset holding value,
ZAR price/rate, or net units for 7, 30, 90, or 365 days. The daily history table
shows the same observations, oldest included holdings timestamp, and connection
coverage. The selected exchange and historical valuation date also constrain
graphs. South African calendar days use the latest saved holdings checkpoint
from each day and prices available at that day's close (or the selected instant).
No holdings are fabricated for days without checkpoints: those days break the
line. Missing prices and incomplete connections produce explicitly partial
valuations, never assumed zero wealth. Stale observations remain marked.

The read-only, budget-authorized `/finance/timeline` endpoint loads daily
checkpoints from encrypted storage and computes exact decimal values before
chart rendering. A bounded set of per-connection/range caches travels through
budget sync for offline graph access. Opening Graphs polls saved history every
minute; it does not trigger exchange collection or backfill market prices.
Privacy mode hides graphs and table amounts. Graphs show observed value changes,
including deposits, withdrawals and trades; they do not calculate investment returns.

Holdings retain native decimal strings; valuations use ZAR. They are separate
from envelope-budget amounts and do not increase money available to budget.
Debt and derivative settlement P&L are included according to each provider's
balance representation. Position notional is never added to wealth.

The page shows connections, coverage, holdings, derivative positions, native
activity, prices and FX sources. Historical dates use saved checkpoints or a
complete cash/spot ledger that can be replayed backwards. Incomplete historical
positions and debt are reported as unavailable rather than inferred from
today's quantities. Missing prices remain unpriced. Stale observations retain
their timestamps.

## Coverage and backfills

- **Luno:** every returned wallet ID/type, balances, row-paginated account
  movements and pending-state visibility. Same-currency wallets stay separate.
- **VALR:** primary and accessible subaccounts, balances and borrowing,
  transaction-history paging, futures/perps position reads.
- **Bitget:** authenticated classic/UTA selection, spot/funding, margin,
  futures equity, savings, classic bot/subaccount balance discovery and
  paginated recent bills. A failed authentication request does not silently
  select another account mode.
- **Binance:** spot/funding, cross/isolated margin, futures equity/positions,
  Simple Earn positions, symbol-specific fills, capital history and accessible
  subaccounts. Available markets are scanned in batches to discover sold assets. Delisted symbols still require explicit symbols or statement backfill.

Coverage is explicit per stream. Account permissions, provider retention,
available product schemas and maximum pages per collection can prevent complete
history. An empty or denied response is not evidence of zero wealth. Binance
and Bitget retain only limited history for some products; import older evidence
where API access ends. Child-account balances do not grant access to child
credentials or every child product.

The versioned JSON archive format supports normalized event backfills and dated
holdings/position checkpoints. Export a connection to see its schema. Imports
validate decimal strings, identifiers, account references and timestamps;
events merge by stable ID. Imported evidence does not automatically certify
history completeness. The latest 2,000 events per connection are cached in the
budget; the server keeps collected history.

Current prices use local Luno ZAR markets, then Binance/USDT crossed with an
observed USDT/ZAR rate. A supplemental market-provider registry adds Kraken
xStocks token markets crossed with dated USD/ZAR, and Bitget spot markets
crossed with observed USDT/ZAR. Token markets are resolved from provider
metadata; ordinary underlying share prices are never substituted. Historical
local candles can fall back to VALR; token and crypto cross rates use completed
candles only. Kraken historical coverage is limited to its recent 720 candles. Fiat FX uses dated ECB reference rates via
EUR. These are reference valuations, not guaranteed execution proceeds or a
tax filing calculation. Unsupported assets/dates remain visibly unpriced. The screen labels the priced
balance and names missing assets when the total excludes unpriced holdings.

## API and CLI

The existing Actual API adds `getFinanceProviders`, `connectFinance`,
`getPortfolio`, `pullPortfolio`, `syncPortfolio`, `getPortfolioHistory`,
`importPortfolio`, and `disconnectFinance`. Server requests require an active
budget and its authorized session or budget-scoped API key.

CLI examples (after building this fork's API/CLI):

```sh
actual finance providers
actual finance list
actual finance sync
actual finance history 2025-11-20
actual finance import CONNECTION_ID archive.json
actual finance connect luno --name 'Luno' --since 2020-01-01
```

The connect command reads `FINANCE_API_KEY`, `FINANCE_API_SECRET` and optional
`FINANCE_API_PASSPHRASE` from its environment. Existing Actual server/budget
connection options still apply. Never put credentials in command arguments.

## Add a provider

1. Implement `AdapterRegistration` in `src/server/providers/`. Supply a
   `ProviderDefinition`, fixed HTTPS hosts, signer, read-only resource allowlist
   and `create({ request })` adapter constructor.
2. Normalize quantities into decimal strings and preserve stable provider IDs.
   Account, holding, position and event envelopes are separate. Explicitly
   distinguish gross assets, debt, equity and unrealized profit to avoid double
   counting.
3. Use `createCollector` and `collectHistory` for failure isolation and bounded,
   durable paging. Declare truncated/unsupported coverage; never silently drop
   a financial stream. New adapters must retain unknown event types for review.
4. Add the registration to the composition root in `factory.ts`, or supply a
   custom registry to `createProviderFactory`. The service, server routes and
   provider-selection UI consume registrations rather than provider switches.
5. Add synthetic contract tests with an injected `Request` or `fetch`. Include
   pagination, permission denial, empty responses, decimal precision, fee signs,
   duplicate records and account mode. Live validation is a separate, explicitly
   authorized operation outside repository fixtures.

Transport signers are independent of normalizers. Price sources implement
`PriceSource`; storage implements `FinanceRepository`. `createFinanceService`
accepts these abstractions and an ownership predicate. New APIs or account
types can reuse this pipeline without importing browser components or opening
database connections inside provider adapters.

## Server state and recovery

Connections are scoped to an active budget. Credentials and collection payloads
are encrypted using AES-256-GCM with connection-bound authenticated context.
The server's `.finance-key` lives in its configured data directory with mode 0600. Back up that key securely together with the account database. Losing it
prevents decryption; restoring the database without its key is insufficient.
The worker host can read these records and is a trusted endpoint, independent
of the budget's end-to-end encryption password.

Collection leases prevent overlapping jobs. Failed streams retain earlier
evidence with coverage errors; failed jobs do not replace prior data. Removing
a connection removes its collected server data. Use archive export before
removing data that may no longer be available from a provider.

Run all Yarn commands from repository root. Required checks remain root lint,
typecheck and tests, plus browser/server/API/CLI builds and focused browser
tests. Visual snapshots use the pinned Linux Playwright image described in
the web client's README. Real credentials and statements must never be added
to automated fixtures or Git history.
