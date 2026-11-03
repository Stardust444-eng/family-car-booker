export class GarageError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "GarageError";
    this.status = status;
  }
}
