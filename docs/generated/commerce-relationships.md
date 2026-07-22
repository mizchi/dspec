# Specification Relationships commerce-domain-fixture

- version: `0.1.0`
- status: `pass`
- nodes: `18`
- relationships: `19`

## Relationship ledger

| From | Relation | To |
| --- | --- | --- |
| `domain/aggregate/purchase-order` | `member` | `domain/entity/purchase-order` |
| `domain/aggregate/purchase-order` | `root` | `domain/entity/purchase-order` |
| `domain/command/create-purchase-order` | `declares-field` | `domain/field/commands/create-purchase-order/orderId` |
| `domain/command/create-purchase-order` | `declares-field` | `domain/field/commands/create-purchase-order/total` |
| `domain/command/create-purchase-order` | `targets-aggregate` | `domain/aggregate/purchase-order` |
| `domain/entity/purchase-order` | `declares-field` | `domain/field/entities/purchase-order/orderId` |
| `domain/entity/purchase-order` | `declares-field` | `domain/field/entities/purchase-order/status` |
| `domain/entity/purchase-order` | `declares-field` | `domain/field/entities/purchase-order/total` |
| `domain/event/purchase-order-created` | `declares-field` | `domain/field/events/purchase-order-created/orderId` |
| `domain/event/purchase-order-created` | `targets-aggregate` | `domain/aggregate/purchase-order` |
| `domain/field/commands/create-purchase-order/total` | `references` | `domain/value-object/money` |
| `domain/field/entities/purchase-order/status` | `references` | `domain/enum/order-status` |
| `domain/field/entities/purchase-order/total` | `references` | `domain/value-object/money` |
| `domain/formalization/order-total-alloy` | `checks-rule` | `rule/ORDER-TOTAL-NON-NEGATIVE` |
| `domain/formalization/order-total-alloy` | `uses-artifact` | `artifact/model/fixtures/alloy-behavior-reservation.pkl` |
| `domain/invariant/order-total-non-negative` | `invariant-of` | `domain/aggregate/purchase-order` |
| `domain/invariant/order-total-non-negative` | `states-rule` | `rule/ORDER-TOTAL-NON-NEGATIVE` |
| `domain/value-object/money` | `declares-field` | `domain/field/valueObjects/money/amount` |
| `domain/value-object/money` | `declares-field` | `domain/field/valueObjects/money/currency` |

## Diagram

```mermaid
flowchart LR
  N0["model fixtures/alloy-behavior-reservation.pkl"]
  N1["aggregate purchase-order"]
  N2["command create-purchase-order"]
  N3["entity purchase-order"]
  N4["enum order-status"]
  N5["event purchase-order-created"]
  N6["create-purchase-order.orderId: uuid"]
  N7["create-purchase-order.total: value-object"]
  N8["purchase-order.orderId: uuid"]
  N9["purchase-order.status: enum"]
  N10["purchase-order.total: value-object"]
  N11["purchase-order-created.orderId: uuid"]
  N12["money.amount: decimal"]
  N13["money.currency: string"]
  N14["formalization order-total-alloy"]
  N15["invariant order-total-non-negative"]
  N16["value-object money"]
  N17["Rule ORDER-TOTAL-NON-NEGATIVE"]
  N1 -->|member| N3
  N1 -->|root| N3
  N2 -->|declares-field| N6
  N2 -->|declares-field| N7
  N2 -->|targets-aggregate| N1
  N3 -->|declares-field| N8
  N3 -->|declares-field| N9
  N3 -->|declares-field| N10
  N5 -->|declares-field| N11
  N5 -->|targets-aggregate| N1
  N7 -->|references| N16
  N9 -->|references| N4
  N10 -->|references| N16
  N14 -->|checks-rule| N17
  N14 -->|uses-artifact| N0
  N15 -->|invariant-of| N1
  N15 -->|states-rule| N17
  N16 -->|declares-field| N12
  N16 -->|declares-field| N13
```
