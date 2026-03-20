export type Rating = 1|2|3|4

export function scheduleCard(card: any, rating: Rating) {
  // Simple deterministic scheduler stub: adjust interval and due date
  const now = Date.now()
  const prevInterval = card.interval ?? 1
  let interval = prevInterval
  if (rating === 1) interval = 0 // again
  if (rating === 2) interval = Math.max(1, Math.round(prevInterval * 1.2))
  if (rating === 3) interval = Math.max(1, Math.round(prevInterval * 2))
  if (rating === 4) interval = Math.max(1, Math.round(prevInterval * 4))
  const nextDue = now + interval * 24 * 60 * 60 * 1000
  const updated = { ...card, interval, due: nextDue, lastReviewed: now }
  return { card: updated, interval }
}

export function intervalLabel(interval: number) {
  if (!interval) return 'soon'
  if (interval < 1) return 'now'
  if (interval === 1) return '1d'
  return `${interval}d`
}
