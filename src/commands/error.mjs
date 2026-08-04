export class CommandError extends Error {
    status;
    constructor(message, status = 1) {
        super(message);
        this.status = status;
    }
}
