/**
 * Global type declarations for Live2D Cubism Core
 * The core is loaded via script tag before the app bundle.
 * Covers the full API surface used by the CubismWebFramework.
 */
declare namespace Live2DCubismCore {
  // ---- Moc ----
  class Moc {
    static fromArrayBuffer(buffer: ArrayBuffer): Moc
    static release(moc: Moc): void
    _release(): void
    hasMocConsistency(fromMoc: any): number
  }

  // ---- Model ----
  class Model {
    static fromMoc(moc: Moc): Model
    setParameterValueById(id: string, value: number): void
    getParameterValueById(id: string): number
    getCanvasWidth(): number
    getCanvasHeight(): number
    getCountParameter(): number
    getParameterIds(): string[]
    getParameterValues(): Float32Array
    getParameterTypes(): number[]
    getCountDrawable(): number
    getDrawableIds(): string[]
    getDrawableIndexCounts(): Int32Array
    getDrawableVertexCounts(): Int32Array
    getDrawableIndices(): Int32Array[]
    getDrawableVertices(): Float32Array[]
    getDrawableVertexUvs(): Float32Array[]
    getDrawableOpacity(): Float32Array
    getDrawableDrawOrders(): Int32Array
    getDrawableRenderOrders(): Int32Array
    getDrawableMultiplyColors(): Float32Array
    getDrawableScreenColors(): Float32Array
    getDrawableParentPartIndices(): Int32Array
    getDrawableIsDoubleSided(): Uint8Array
    getDrawableIsVisible(): Uint8Array
    getDrawableBlendMode(): Int32Array
    getDrawableMaskCounts(): Int32Array
    getDrawableMasks(): Int32Array[]
    getDrawableVertexPositions(): Float32Array[]
    getCountParts(): number
    getPartIds(): string[]
    getPartOpacities(): Float32Array
    getPartParentPartIndices(): Int32Array
    getDrawableInvertedMaskFlags(): Uint8Array
    getDrawableVertexUpdates(): Uint8Array
    canHasMoreDrawables(): boolean
    saveParameters(): void
    getDrawableMultiplyColorsAsFloat32Array(): Float32Array
    getDrawableScreenColorsAsFloat32Array(): Float32Array
    getDrawableIsVisibleAsBooleanArray(): Uint8Array
    getDrawableBlendModeAsInt32Array(): Int32Array
    update(): boolean
    init(): void
    delete(): void
    release(): void

    // Sub-objects accessed as properties (used by framework)
    drawables: any
    parameters: any
    parts: any
    canvasinfo: any
    offscreens: any
    getRenderOrders(): Int32Array
  }

  // ---- Version ----
  namespace Version {
    function csmGetMocVersion(buffer: ArrayBuffer): number
    function csmGetLatestMocVersion(): number
    function csmGetVersion(): number
  }

  // ---- Logging ----
  namespace Logging {
    function csmSetLogFunction(fn: csmLogFunction): void
    function csmGetLogFunction(): csmLogFunction
    const CubismLogPrint: csmLogFunction
    const CubismLogDebug: csmLogFunction
    const CubismLogInfo: csmLogFunction
    const CubismLogWarning: csmLogFunction
    const CubismLogError: csmLogFunction
    const CubismLogVerbose: csmLogFunction
  }

  // ---- Memory ----
  namespace Memory {
    function csmAllocate(size: number, alignment: number): ArrayBuffer
    function csmDeallocate(memory: ArrayBuffer): void
    function csmInitializeAllocator(): void
    function csmReleaseAllocator(): void
    function initializeAmountOfMemory(size: number): void
    const CubismAllocateFunction: any
    const CubismDeallocateFunction: any
  }

  // ---- Utils ----
  namespace Utils {
    function hasMocConsistencyFromList(buffer: ArrayBuffer): boolean
    function getRenderOrders(): Int32Array
    function hasIsDoubleSidedBit(flags: number): boolean
    function hasVertexPositionsDidChangeBit(flags: number): boolean
    function hasBlendAdditiveBit(flags: number): boolean
    function hasBlendMultiplicativeBit(flags: number): boolean
    function hasIsInvertedMaskBit(flags: number): boolean
    function hasIsVisibleBit(flags: number): boolean
    function hasVisibilityDidChangeBit(flags: number): boolean
    function hasOpacityDidChangeBit(flags: number): boolean
    function hasRenderOrderDidChangeBit(flags: number): boolean
    function hasBlendColorDidChangeBit(flags: number): boolean
  }

  // ---- Color Blend Types (constants on namespace) ----
  const ColorBlendType_Normal: number
  const ColorBlendType_AddGlow: number
  const ColorBlendType_Add: number
  const ColorBlendType_Darken: number
  const ColorBlendType_Multiply: number
  const ColorBlendType_ColorBurn: number
  const ColorBlendType_LinearBurn: number
  const ColorBlendType_Lighten: number
  const ColorBlendType_Screen: number
  const ColorBlendType_ColorDodge: number
  const ColorBlendType_Overlay: number
  const ColorBlendType_SoftLight: number
  const ColorBlendType_HardLight: number
  const ColorBlendType_LinearLight: number
  const ColorBlendType_Hue: number
  const ColorBlendType_Color: number
  const ColorBlendType_AddCompatible: number
  const ColorBlendType_MultiplyCompatible: number

  // ---- Type aliases used by framework ----
  type csmLogFunction = (message: string) => void
  type csmParameterType = number
}

declare const Live2DCubismCore: {
  Moc: typeof Live2DCubismCore.Moc
  Model: typeof Live2DCubismCore.Model
  Version: typeof Live2DCubismCore.Version
  Logging: typeof Live2DCubismCore.Logging
  Memory: typeof Live2DCubismCore.Memory
  Utils: typeof Live2DCubismCore.Utils
  ColorBlendType_Normal: number
  ColorBlendType_AddGlow: number
  ColorBlendType_Add: number
  ColorBlendType_Darken: number
  ColorBlendType_Multiply: number
  ColorBlendType_ColorBurn: number
  ColorBlendType_LinearBurn: number
  ColorBlendType_Lighten: number
  ColorBlendType_Screen: number
  ColorBlendType_ColorDodge: number
  ColorBlendType_Overlay: number
  ColorBlendType_SoftLight: number
  ColorBlendType_HardLight: number
  ColorBlendType_LinearLight: number
  ColorBlendType_Hue: number
  ColorBlendType_Color: number
  ColorBlendType_AddCompatible: number
  ColorBlendType_MultiplyCompatible: number
} & { [key: string]: any }
