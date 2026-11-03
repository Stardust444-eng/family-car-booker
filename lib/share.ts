export function familyInvite(name: string, url: string): string {
  return `${name} cars: ${url}\nOpen it, pick your name, and request a car. No app and no account.`;
}

export function approvalReminder(name: string, url: string): string {
  return `Approval link for ${name}: ${url}\nKeep this private. It is the only way to approve a car request.`;
}

export function requestText(driver: string, car: string | null, when: string, reason: string): string {
  const which = car ? `the ${car}` : "a car";
  return `${driver} requested ${which} ${when} for ${reason}. An admin can answer from the approval link.`;
}
