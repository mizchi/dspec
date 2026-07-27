module commerce_reservation_release_before_reserve_alloy_v1

sig Customer {}
sig Product {}

one sig ReservationState {
  var owner: Product -> lone Customer
}

fact Initial {
  no ReservationState.owner
}

pred reserve[c: Customer, p: Product] {
  no p.(ReservationState.owner)
  ReservationState.owner' = ReservationState.owner + p->c
}

pred release[c: Customer, p: Product] {
  p->c in ReservationState.owner
  ReservationState.owner' = ReservationState.owner - p->c
}

pred stutter {
  ReservationState.owner' = ReservationState.owner
}

fact Transitions {
  always (
    some ReservationState.owner =>
      (some c: Customer, p: Product | release[c, p]) else
      ((some c: Customer, p: Product | reserve[c, p]) or stutter)
  )
}

pred ReservationWorld {
  some Customer
  some Product
}

pred ReservationCanBeReserved {
  eventually some ReservationState.owner
}

pred ReservationCanBeReleased {
  eventually (some ReservationState.owner and after no ReservationState.owner)
}

run ReservationWorld for exactly 2 Customer, exactly 2 Product, 4 steps

run ReservationCanBeReserved for exactly 2 Customer, exactly 2 Product, 4 steps

run ReservationCanBeReleased for exactly 2 Customer, exactly 2 Product, 4 steps


assert ReservationExclusive {
  always (all p: Product | lone p.(ReservationState.owner))
}

check ReservationExclusive for exactly 2 Customer, exactly 2 Product, 4 steps

assert ReservationEventuallyReleased {
  always (all p: Product |
    (some p.(ReservationState.owner) implies eventually no p.(ReservationState.owner)))
}

check ReservationEventuallyReleased for exactly 2 Customer, exactly 2 Product, 4 steps

assert ReservationOwnerCapacity {
  always (all c: Customer | lone c.~(ReservationState.owner))
}

check ReservationOwnerCapacity for exactly 2 Customer, exactly 2 Product, 4 steps
