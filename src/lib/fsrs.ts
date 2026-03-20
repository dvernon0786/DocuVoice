// FSRS v5 — Free Spaced Repetition Scheduler
// Based on the open-source FSRS algorithm by Jarrett Ye
// https://github.com/open-spaced-repetition/fsrs4anki

import type { Card } from './db'

export type Rating = 1 | 2 | 3 | 4  // Again, Hard, Good, Easy

export type SchedulingResult = {
  card: Card
  interval: number     // days until next review
  nextReview: number   // timestamp ms
}

// FSRS v5 default parameters
const W = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102,
  0.5316, 1.0651, 0.0589, 1.5330, 0.1544,
  1.0070, 1.9395, 0.1100, 0.2900, 2.2700,
  0.2500, 2.9898, 0.5100, 0.3740,
]

const DECAY = -0.5
const FACTOR = 19 / 81
const MIN_DIFFICULTY = 1
const MAX_DIFFICULTY = 10

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val))
}

function initDifficulty(rating: Rating): number {
  return clamp(W[4] - Math.exp(W[5] * (rating - 1)) + 1, MIN_DIFFICULTY, MAX_DIFFICULTY)
}

function initStability(rating: Rating): number {
  return Math.max(W[rating - 1], 0.1)
}

function nextDifficulty(d: number, rating: Rating): number {
  const deltaD = -W[6] * (rating - 3)
  return clamp(d + deltaD * ((10 - d) / 9), MIN_DIFFICULTY, MAX_DIFFICULTY)
}

function shortTermStability(s: number, rating: Rating): number {
  return s * Math.exp(W[17] * (rating - 3 + W[18]))
}

function recallProbability(elapsedDays: number, stability: number): number {
  return Math.pow(1 + FACTOR * (elapsedDays / stability), DECAY)
}

function nextRecallStability(d: number, s: number, r: number, rating: Rating): number {
  const hardPenalty = rating === 2 ? W[15] : 1
  const easyBonus = rating === 4 ? W[16] : 1
  return s * (
    Math.exp(W[8]) *
    (11 - d) *
    Math.pow(s, -W[9]) *
    (Math.exp((1 - r) * W[10]) - 1) *
    hardPenalty *
    easyBonus
  )
}

function nextForgetStability(d: number, s: number, r: number): number {
  return (
    W[11] *
    Math.pow(d, -W[12]) *
    (Math.pow(s + 1, W[13]) - 1) *
    Math.exp((1 - r) * W[14])
  )
}

function nextInterval(stability: number, requestRetention = 0.9): number {
  const interval = (stability / FACTOR) * (Math.pow(requestRetention, 1 / DECAY) - 1)
  return Math.max(1, Math.round(interval))
}

export function scheduleCard(card: Card, rating: Rating): SchedulingResult {
  const now = Date.now()
  const elapsedDays = card.lastReview
    ? Math.max(0, (now - card.lastReview) / 86400000)
    : 0

  let newCard = { ...card, lastReview: now, reps: card.reps + 1 }

  if (card.state === 'new') {
    // First review — initialise stability and difficulty
    newCard.stability = initStability(rating)
    newCard.difficulty = initDifficulty(rating)

    if (rating === 1) {
      newCard.state = 'learning'
      newCard.scheduledDays = 0
      newCard.nextReview = now + 1 * 60 * 1000  // 1 min
    } else if (rating === 2) {
      newCard.state = 'learning'
      newCard.scheduledDays = 0
      newCard.nextReview = now + 5 * 60 * 1000  // 5 min
    } else if (rating === 3) {
      newCard.state = 'review'
      newCard.scheduledDays = nextInterval(newCard.stability)
      newCard.nextReview = now + newCard.scheduledDays * 86400000
    } else {
      newCard.state = 'review'
      newCard.stability = shortTermStability(newCard.stability, rating)
      newCard.scheduledDays = nextInterval(newCard.stability)
      newCard.nextReview = now + newCard.scheduledDays * 86400000
    }
  } else if (card.state === 'learning' || card.state === 'relearning') {
    newCard.stability = shortTermStability(card.stability, rating)
    if (rating === 1) {
      newCard.nextReview = now + 1 * 60 * 1000
      newCard.scheduledDays = 0
    } else if (rating === 2) {
      newCard.nextReview = now + 5 * 60 * 1000
      newCard.scheduledDays = 0
    } else {
      newCard.state = 'review'
      newCard.scheduledDays = nextInterval(newCard.stability)
      newCard.nextReview = now + newCard.scheduledDays * 86400000
    }
  } else {
    // review state
    const r = recallProbability(elapsedDays, card.stability)
    newCard.difficulty = nextDifficulty(card.difficulty, rating)

    if (rating === 1) {
      newCard.state = 'relearning'
      newCard.lapses = card.lapses + 1
      newCard.stability = nextForgetStability(newCard.difficulty, card.stability, r)
      newCard.scheduledDays = 0
      newCard.nextReview = now + 1 * 60 * 1000
    } else {
      newCard.stability = nextRecallStability(newCard.difficulty, card.stability, r, rating)
      newCard.scheduledDays = nextInterval(newCard.stability)
      newCard.nextReview = now + newCard.scheduledDays * 86400000
    }
  }

  newCard.elapsedDays = Math.round(elapsedDays)

  return {
    card: newCard,
    interval: newCard.scheduledDays,
    nextReview: newCard.nextReview!,
  }
}

export function ratingLabel(r: Rating): string {
  return { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' }[r]
}

export function intervalLabel(days: number): string {
  if (days === 0) return '<10 min'
  if (days === 1) return '1 day'
  if (days < 30) return `${days} days`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${(days / 365).toFixed(1)}yr`
}
