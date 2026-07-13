export const app = {
  get(_path: string, _handler: unknown) {},
};

app.get("/api/ping", () => new Response("pong"));
