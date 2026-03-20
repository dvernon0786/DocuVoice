export async function generateCards(text: string, _unused1?: any, pageIndex?: number, _unused2?: any, medMode?: boolean, _apiKey?: string | null) {
  // Simple generator: split into sentences and return 3 cards
  const sentences = text.split(/(?<=[.?!])\s+/).filter(Boolean)
  const take = medMode ? 4 : 3
  const out = sentences.slice(0, take).map((s, i) => ({
    front: medMode ? `Cloze: ${s.slice(0, 60)}${s.length>60?'...':''}` : s.slice(0, 80) + (s.length>80?'...':''),
    back: s,
    tags: medMode ? ['medical','high-yield'] : [],
    meta: { sourcePage: pageIndex }
  }))
  return out
}

export default { generateCards }
