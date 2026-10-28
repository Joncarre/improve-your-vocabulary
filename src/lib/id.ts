/** New random UUID for a record id (never an auto-increment: records are created on several devices). */
export function newId(): string {
  return crypto.randomUUID()
}
