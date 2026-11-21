# GoCardless Bank Adapters

Adapters normalize differences in the provider's account, transaction, and
balance payloads. [banks/integration-bank.ts](banks/integration-bank.ts) is the
fallback for institutions without a custom adapter.

## Add or Change an Adapter

1. Identify the institution ID from an existing synthetic provider fixture or
   a separately obtained, sanitized example. Do not collect live financial
   data or call external bank services for repository tests.
2. Create a TypeScript module in `banks/` following the existing filename
   pattern, such as `example_bank_0000.ts`. Export an object that spreads the
   fallback and `satisfies IBank`; these adapters are objects, not classes.
3. Put supported provider IDs in `institutionIds`. Override only methods that
   need different behavior.
4. Add synthetic cases under `banks/tests/`, including transaction dates,
   booking/pending behavior, sorting, and balance handling where relevant.
5. Run the GoCardless tests from the repository root:

   ```sh
   yarn workspace @actual-app/sync-server test src/app-gocardless
   ```

[bank-factory.ts](bank-factory.ts) discovers `./banks/*_*.{ts,js}` eagerly via
Vite's `import.meta.glob`. A new adapter needs a matching filename and default
export; there is no manual registration list. Factory tests check discovery
and institution IDs.

## Adapter Contract

[banks/bank.interface.ts](banks/bank.interface.ts) defines `IBank`:

| Method                                                          | Result                                             |
| --------------------------------------------------------------- | -------------------------------------------------- |
| `normalizeAccount(account)`                                     | Normalized account details for the client          |
| `normalizeTransaction(transaction, booked, editedTransaction?)` | A normalized transaction, or `null` to omit it     |
| `sortTransactions(transactions)`                                | Transactions ordered newest first                  |
| `calculateStartingBalance(sortedTransactions, balances)`        | Integer amount preceding the supplied transactions |

For examples, see [mbank_retail_brexplpw.ts](banks/mbank_retail_brexplpw.ts)
and its [tests](banks/tests/mbank_retail_brexplpw.spec.ts). The provider types
are in [gocardless-node.types.ts](gocardless-node.types.ts).

## Transaction Overrides

Keep raw provider fields available for client-side mapping. To customize the
normalized date, payee name, or notes, create a shallow edited copy and pass it
as the third argument to the fallback. For example:

```ts
import type { IBank } from './bank.interface';
import Fallback from './integration-bank';

export default {
  ...Fallback,
  institutionIds: ['EXAMPLE_BANK_0000'],

  normalizeTransaction(transaction, booked) {
    const edited = {
      ...transaction,
      notes:
        transaction.remittanceInformationStructured ??
        transaction.remittanceInformationUnstructured,
    };
    return Fallback.normalizeTransaction(transaction, booked, edited);
  },
} satisfies IBank;
```

The fallback returns `null` when no usable date is present. It computes
normalized fields while retaining raw fields and derived remittance strings.
Check [integration-bank.ts](banks/integration-bank.ts) before relying on its
balance preference order or date selection. Financial conversions use
`amountToInteger` from [utils.ts](utils.ts); tests should verify amounts as
well as labels.
