-- name: list-all-orders :many
SELECT *
FROM orders;

-- name: list-payment-orders-without-fk-join :many
SELECT payments.id, orders.status
FROM payments
JOIN orders ON payments.id = orders.id
WHERE payments.tenant_id = ?;

-- name: list-missing-column :many
SELECT orders.missing_column
FROM orders
WHERE orders.tenant_id = ?;

-- name: create-payment-without-tenant :one
INSERT INTO payments (id, order_id)
VALUES (?, ?);
