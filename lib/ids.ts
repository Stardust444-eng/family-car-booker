import { randomBytes } from "node:crypto";

import { GarageError } from "@/lib/errors";

const ID_RE = /^[a-z]{2,4}_[A-Za-z0-9_-]{8,40}$/;

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("base64url")}`;
}

export function isId(value: string): boolean {
  return ID_RE.test(value);
}

export function assertId(value: string): void {
  if (!isId(value)) {
    throw new GarageError("That link does not match a garage.", 404);
  }
}
