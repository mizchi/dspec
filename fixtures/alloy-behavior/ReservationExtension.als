module ReservationExtension

open CommerceReservationGenerated

// This is intentionally authored Alloy.  It relies on the generated state and
// transition facts, then asks an additional question about owner capacity.
assert ExtensionOwnerCapacity {
  always (all c: Customer | lone c.~(ReservationState.owner))
}

check ExtensionOwnerCapacity for exactly 2 Customer, exactly 2 Product, 4 steps
