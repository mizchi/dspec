const app = {
  get(_path: string, _handler: unknown) {},
};

app.get("/api/audit", () => {});
app.get("/api/orders", () => {});
app.get("/api/order-lines", () => {});
