declare module 'ts-fsrs' {
  export type FSRSCard = {
    front?: string
    back?: string
    tags?: string[]
    meta?: Record<string, any>
  }

  export type RepeatOptions = {
    card: FSRSCard
    rating: number
  }

  export function repeat(opts: RepeatOptions): Promise<any>

  const _default: {
    repeat: typeof repeat
  }

  export default _default
}
