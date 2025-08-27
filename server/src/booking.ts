export function getAvailableSlots() {
  return ["2025-08-27T10:00:00", "2025-08-27T11:00:00"];
}

export function bookSlot(slot: string, user: string) {
  return { success: true, slot, user };
}
