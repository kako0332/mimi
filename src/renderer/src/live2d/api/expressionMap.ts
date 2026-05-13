/**
 * Expression mapping: UI expression names → Live2D expression indices
 * Maps the app's Expression type to Live2D model expression indices.
 * The actual index depends on the model's expression count.
 */
export type Live2DExpression = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'thinking' | 'sleeping'

/** Map from app Expression to Live2D expression name in model3.json */
export const EXPRESSION_MAP: Record<string, string> = {
  idle: 'neutral',
  happy: 'happy',
  talking: 'neutral',  // talking uses motion, not expression
  sad: 'sad',
  thinking: 'thinking',
  sleeping: 'neutral'  // sleeping uses idle animation
}

/** Map from emotion tag (from AI) to app Expression */
export const EMOTION_TO_EXPRESSION: Record<string, string> = {
  neutral: 'idle',
  happy: 'happy',
  sad: 'sad',
  angry: 'sad',      // fallback to sad if no angry expression
  surprised: 'happy', // fallback to happy
  thinking: 'thinking',
  sleeping: 'sleeping'
}
