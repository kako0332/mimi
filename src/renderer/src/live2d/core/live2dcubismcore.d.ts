/**
 * Global type declarations for Live2D Cubism Core
 * The core is loaded via script tag before the app bundle.
 */
declare namespace Live2DCubismCore {
  class Moc {
    static fromArrayBuffer(buffer: ArrayBuffer): Moc
    static release(moc: Moc): void
  }

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
  }

  namespace Version {
    function csmGetMocVersion(buffer: ArrayBuffer): number
    function csmGetLatestMocVersion(): number
  }
}

declare const Live2DCubismCore: {
  Moc: typeof Live2DCubismCore.Moc
  Model: typeof Live2DCubismCore.Model
  Version: typeof Live2DCubismCore.Version
  [key: string]: any
}
