export const TICKET_STATUSES = [
  "open",
  "in_progress",
  "pending",
  "escalated",
  "resolved",
  "closed"
];

export const TICKET_PRIORITIES = ["low", "medium", "high", "critical"];

/** Hours from creation used to compute `slaDeadline` when not explicitly set. */
export const SLA_HOURS_BY_PRIORITY = {
  low: 168,
  medium: 72,
  high: 24,
  critical: 4
};
