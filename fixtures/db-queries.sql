-- name: list-tenant-orders :many
SELECT orders.id, orders.status
FROM orders
WHERE orders.tenant_id = ?;

-- name: list-tenant-payments :many
SELECT payments.id, payments.order_id
FROM payments
JOIN orders ON payments.order_id = orders.id
WHERE payments.tenant_id = ? AND orders.tenant_id = ?;

-- name: create-payment :one
INSERT INTO payments (id, tenant_id, order_id)
VALUES (?, ?, ?);
