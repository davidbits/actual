# Bank statement ingestion

The `@actual-app/finance/statements` Node entry point parses bank exports through
a provider registry. The CLI can inspect and convert files without connecting
to Actual. Import uses Actual's existing transaction matching, rules, splits,
payees and transfer handling.

Run commands from the repository root, after building the CLI:

```sh
yarn workspace @actual-app/cli build
node packages/cli/dist/cli.js statements providers
node packages/cli/dist/cli.js statements inspect current.csv card.csv
node packages/cli/dist/cli.js statements convert current.csv --output current.actual.json
```

`convert` writes a new file with mode 0600 and refuses to overwrite an existing
file. Its output is an array accepted by `actual transactions import --file`.
Amounts and balances in JSON summaries are integer cents. Original account
numbers are replaced with a fingerprint and masked suffix.

For direct ingestion, configure the existing Actual CLI server, authentication,
data directory and budget sync ID options or environment variables. Choose the
current account or credit-card account explicitly:

```sh
node packages/cli/dist/cli.js accounts list
node packages/cli/dist/cli.js statements import current.csv --account ACTUAL_CURRENT_ID
node packages/cli/dist/cli.js statements import current.csv --account ACTUAL_CURRENT_ID --apply
node packages/cli/dist/cli.js statements import card.csv --account ACTUAL_CARD_ID --apply
```

Import previews by default. `--apply` imports and syncs the selected budget.
Balance reconciliation errors block conversion and import. A target account
already containing imports from a different source account of the same provider
is rejected. Use separate Actual accounts for current and credit-card activity.
Statements are ZAR exports; the target budget must use ZAR amounts.

## Supported Nedbank formats

The parser recognizes **Statement Enquiry** exports with **Account Number** and
**Account Description** metadata. Files may contain quoted commas, multiline
descriptions, CRLF or LF endings and a UTF byte-order mark. CLI decoding defaults
to UTF-8 or the UTF-16 BOM; use `--encoding windows-1252` for a known legacy file.
Invalid text, dates, amounts, unexpected columns and conflicting metadata fail
before any budget connection is opened.

| Export      | Fields                                                   | Treatment                                                               |
| ----------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| Current     | `ddMMMyyyy`, description, signed amount, running balance | Reconcile each balance transition in integer cents.                     |
| Credit card | `dd-MMM-yyyy`, second date, description, signed amount   | Keep both dates, retain the provided amount sign; balances unavailable. |

The first card date is used by default. `--date-field secondary` selects the
second date for Actual; both remain in notes. The source files do not label
these columns, so the tool preserves their order without guessing a different
time zone. Choose one policy before first import. Reimporting the same ID does
not overwrite an existing Actual transaction date.

**BROUGHT FORWARD**, **CARRIED FORWARD**, VAT summaries with no amount and other
unchanged-balance notices are excluded from transactions. Explicit fee/VAT
rows with amounts remain transactions. Rows after **PROVISIONAL STATEMENT**
are imported uncleared. A finalized export clears matching IDs; review any
provisional amount or description that changes before finalization.

An initial current-account balance can be inferred from the first amount and
running balance if the opening marker is blank. It is reported, never inserted
automatically. Set an appropriate dated opening balance in Actual when needed.
Credit exports without balance columns cannot establish opening debt or prove
the final account balance. The filename's requested range does not establish
the actual range of available transactions.

Stable IDs include the source account, both dates, description, signed amount,
running balance where available and occurrence count. Repeating or overlapping
an export does not duplicate identical IDs. Two genuinely equal card purchases
remain separate. Since the bank provides no transaction identifier in these
formats, overlapping exports should include complete dates: splitting a day
containing indistinguishable rows can change their occurrence numbering.
Deleted Actual transactions remain deleted under normal import preferences.

The tool does not label card repayments as spending or infer transfer recipients.
Use Actual transfer payees/rules to link current-to-card and bank-to-exchange
movements. Reviewing the import preview preserves the existing budget's matching
and categorization decisions.

## Add another bank

Implement `StatementAdapter` (`id`, `name`, `detect`, `parse`) returning a
`BankStatement`, then register it with `createStatementFactory`. Keep provider
parsing independent of CLI and database access. Imported IDs use the
`PROVIDER:v1:ACCOUNT_FINGERPRINT:...` namespace so the shared importer can prevent
mixing source accounts. Return explicit reconciliation issues instead of
silently dropping rows. `statementTransactions` is the shared projection into
Actual's existing import shape.

Parser and CLI tests use synthetic CSV strings. A core regression test exercises
Actual preview, repeat imports, overlapping exports, equal card purchases and
deleted transactions against a temporary test database. Personal CSV files and
normalized exports belong outside Git and must never become test fixtures.

Nedbank documents its available export formats in its
[online banking guide](https://nedbank.co.za/content/dam/nedbank/site-assets/Personal/Digital/OnlineBanking/Nedbank%20Online%20Banking%20How%20To%20Guide%20Sept2020.pdf).
The two parser layouts were established by inspecting the supplied local files;
the guide does not specify their complete CSV schema.
