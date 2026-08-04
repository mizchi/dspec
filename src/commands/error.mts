export class CommandError extends Error {
  readonly status: number;

  constructor(message: string, status = 1) {
    super(message);
    this.status = status;
  }
}
