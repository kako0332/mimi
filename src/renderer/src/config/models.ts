export interface ModelInfo {
  id: string
  name: string
  url: string
  emoji: string
}

export const MODELS: ModelInfo[] = [
  { id: 'hiyori', name: 'Hiyori', url: '/live2d/Hiyori/Hiyori.model3.json', emoji: '👧' },
  { id: 'mark', name: 'Mark', url: '/live2d/Mark/Mark.model3.json', emoji: '🧑' },
  { id: 'natori', name: 'Natori', url: '/live2d/Natori/Natori.model3.json', emoji: '🐱' },
  { id: 'rice', name: 'Rice', url: '/live2d/Rice/Rice.model3.json', emoji: '🐰' },
]

export const DEFAULT_MODEL = MODELS[0]

export function getModelById(id: string): ModelInfo | undefined {
  return MODELS.find(m => m.id === id)
}
