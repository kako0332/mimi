import { CubismFramework } from '../framework/live2dcubismframework'
import { CubismUserModel } from '../framework/model/cubismusermodel'
import { CubismModelSettingJson } from '../framework/cubismmodelsettingjson'
import { CubismEyeBlink } from '../framework/effect/cubismeyeblink'
import { CubismBreath, BreathParameterData } from '../framework/effect/cubismbreath'
import { CubismExpressionMotion } from '../framework/motion/cubismexpressionmotion'
import { CubismMotion } from '../framework/motion/cubismmotion'
import { CubismDefaultParameterId } from '../framework/cubismdefaultparameterid'
import { CubismRenderer_WebGL } from '../framework/rendering/cubismrenderer_webgl'
import { CubismMatrix44 } from '../framework/math/cubismmatrix44'
import { EXPRESSION_MAP } from './expressionMap'

async function fetchBuffer(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const resp = await fetch(url, { signal })
  if (!resp.ok) throw new Error(`Fetch failed: ${url} status=${resp.status}`)
  const buffer = await resp.arrayBuffer()
  if (!buffer || buffer.byteLength === 0) throw new Error(`Empty response: ${url}`)
  return buffer
}

class LAppModel extends CubismUserModel {
  private _setting: CubismModelSettingJson | null = null
  private _homeDir: string = ''
  private _blinkCtrl: CubismEyeBlink | null = null
  private _breathCtrl: CubismBreath | null = null
  private _exprMap: Map<string, CubismExpressionMotion> = new Map()
  private _motionMap: Map<string, CubismMotion[]> = new Map()

  async load(gl: WebGL2RenderingContext, modelUrl: string, signal?: AbortSignal): Promise<void> {
    const arrayBuffer = await fetchBuffer(modelUrl, signal)
    const setting = new CubismModelSettingJson(arrayBuffer, arrayBuffer.byteLength)
    this._setting = setting

    const url = new URL(modelUrl, window.location.href)
    this._homeDir = url.href.substring(0, url.href.lastIndexOf('/') + 1)

    // Load Moc
    const mocFileName = setting.getModelFileName()
    if (mocFileName) {
      const mocBuffer = await fetchBuffer(this._homeDir + mocFileName, signal)
      this.loadModel(mocBuffer)
    }

    if (!this._model) {
      throw new Error('Failed to load model moc data')
    }

    // Create and setup renderer
    this.createRenderer(
      this._model.getCanvasWidth(),
      this._model.getCanvasHeight()
    )

    const renderer = this.getRenderer() as CubismRenderer_WebGL
    if (renderer) {
      renderer.startUp(gl)
      renderer.setIsPremultipliedAlpha(true)
    }

    // Load textures
    const textureCount = setting.getTextureCount()
    for (let i = 0; i < textureCount; i++) {
      const texName = setting.getTextureFileName(i)
      if (!texName) continue
      await this.loadTexture(gl, i, this._homeDir + texName, signal)
    }

    // Load expressions
    const expressionCount = setting.getExpressionCount()
    for (let i = 0; i < expressionCount; i++) {
      const expName = setting.getExpressionName(i)
      const expFile = setting.getExpressionFileName(i)
      if (!expFile) continue
      try {
        const expBuffer = await fetchBuffer(this._homeDir + expFile, signal)
        const motion = this.loadExpression(expBuffer, expBuffer.byteLength, expName)
        if (motion && motion instanceof CubismExpressionMotion) {
          this._exprMap.set(expName, motion)
        }
      } catch { /* expression optional */ }
    }

    // Load motions
    const groupCount = setting.getMotionGroupCount()
    for (let g = 0; g < groupCount; g++) {
      const group = setting.getMotionGroupName(g)
      if (!group) continue
      const motionCount = setting.getMotionCount(group)
      const motions: CubismMotion[] = []
      for (let m = 0; m < motionCount; m++) {
        const motionFile = setting.getMotionFileName(group, m)
        if (!motionFile) continue
        try {
          const motionBuffer = await fetchBuffer(this._homeDir + motionFile, signal)
          const motion = this.loadMotion(
            motionBuffer, motionBuffer.byteLength,
            `${group}_${m}`,
            undefined, undefined,
            setting, group, m
          )
          if (motion) {
            motion.setEffectIds([], [])
            motions.push(motion)
          }
        } catch { /* motion optional */ }
      }
      this._motionMap.set(group, motions)
    }

    // Eye blink
    this._blinkCtrl = CubismEyeBlink.create(setting)

    // Breath
    this._breathCtrl = CubismBreath.create()
    this._breathCtrl.setParameters([{
      parameterId: CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamBreath),
      offset: 0.0, peak: 0.5, cycle: 3.235, weight: 0.5
    }])

    // Physics
    const physicsFile = setting.getPhysicsFileName()
    if (physicsFile) {
      try {
        const physBuffer = await fetchBuffer(this._homeDir + physicsFile, signal)
        this.loadPhysics(physBuffer, physBuffer.byteLength)
      } catch { /* optional */ }
    }

    // Pose
    const poseFile = setting.getPoseFileName()
    if (poseFile) {
      try {
        const poseBuffer = await fetchBuffer(this._homeDir + poseFile, signal)
        this.loadPose(poseBuffer, poseBuffer.byteLength)
      } catch { /* optional */ }
    }

    this.setInitialized(true)
  }

  private async loadTexture(gl: WebGL2RenderingContext, index: number, url: string, signal?: AbortSignal): Promise<void> {
    const texture = gl.createTexture()
    if (!texture) return

    const image = new Image()
    image.crossOrigin = 'anonymous'

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error(`Texture load failed: ${url}`))
      image.src = url
    })

    if (signal?.aborted) return

    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.bindTexture(gl.TEXTURE_2D, null)

    const renderer = this.getRenderer() as CubismRenderer_WebGL
    if (renderer) renderer.bindTexture(index, texture)
  }

  setExpressionByName(name: string): void {
    const motion = this._exprMap.get(name)
    if (!motion) return
    this._expressionManager?.startMotion(motion, false)
  }

  startMotionByGroup(group: string, index: number = 0, priority: number = 3): void {
    const motions = this._motionMap.get(group)
    if (!motions || index >= motions.length) return
    this._motionManager?.startMotionPriority(motions[index], false, priority)
  }

  getMotionCount(group: string): number {
    return this._motionMap.get(group)?.length || 0
  }

  update(deltaTimeSeconds: number, projectionMatrix: CubismMatrix44): void {
    if (!this._model || !this.isInitialized()) return

    try {
      if (this._dragManager) this._dragManager.update(deltaTimeSeconds)
      this._expressionManager?.updateMotion(this._model, deltaTimeSeconds)
      this._motionManager?.updateMotion(this._model, deltaTimeSeconds)
      this._blinkCtrl?.updateParameters(this._model, deltaTimeSeconds)
      this._breathCtrl?.updateParameters(this._model, deltaTimeSeconds)
      this._physics?.evaluate(this._model, deltaTimeSeconds)
      this._pose?.updateParameters(this._model, deltaTimeSeconds)
    } catch { /* skip frame on update error */ }

    // Look-at
    if (this._dragManager) {
      this._model.addParameterValueById(CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamAngleX), this._dragManager.getX())
      this._model.addParameterValueById(CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamAngleY), this._dragManager.getY())
      this._model.addParameterValueById(CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamAngleZ), this._dragManager.getX() * this._dragManager.getY() * -30)
      this._model.addParameterValueById(CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamBodyAngleX), this._dragManager.getX() * 10)
      this._model.addParameterValueById(CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamEyeBallX), this._dragManager.getX())
      this._model.addParameterValueById(CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamEyeBallY), this._dragManager.getY())
    }

    this._model.saveParameters()
    this._model.update()

    const renderer = this.getRenderer() as CubismRenderer_WebGL
    if (renderer) {
      const mvpMatrix = projectionMatrix.clone()
      mvpMatrix.multiplyByMatrix(this._modelMatrix)
      renderer.setMvpMatrix(mvpMatrix)
      try {
        renderer.drawModel('/live2d/Shaders/')
      } catch { /* shaders may not be loaded yet */ }
    }
  }

  hitTest(x: number, y: number): string[] {
    if (!this._setting || !this._model) return []
    const hitAreas: string[] = []
    const count = this._setting.getHitAreasCount()
    for (let i = 0; i < count; i++) {
      const id = this._setting.getHitAreaId(i)
      const name = this._setting.getHitAreaName(i)
      if (this.isHit(id, x, y)) hitAreas.push(name)
    }
    return hitAreas
  }

  override release(): void {
    if (this._blinkCtrl) { CubismEyeBlink.delete(this._blinkCtrl); this._blinkCtrl = null }
    if (this._breathCtrl) { CubismBreath.delete(this._breathCtrl); this._breathCtrl = null }
    super.release()
  }
}

export class Live2DAdapter {
  private _canvas: HTMLCanvasElement
  private _gl: WebGL2RenderingContext | null = null
  private _model: LAppModel | null = null
  private _animFrameId: number = 0
  private _lastTime: number = 0
  private _initialized: boolean = false
  private _disposed: boolean = false
  private _projectionMatrix: CubismMatrix44 | null = null
  private static _frameworkReady = false

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas
  }

  private async ensureFramework(signal?: AbortSignal): Promise<void> {
    if (this._initialized) return

    const coreReady = () => {
      const core = (window as any).Live2DCubismCore
      if (!core) return false
      try { return typeof core.Version.csmGetVersion() === 'number' } catch { return false }
    }
    if (!coreReady()) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Live2D Core load timeout')), 10000)
        const check = () => {
          if (signal?.aborted) { clearTimeout(timeout); reject(new DOMException('Aborted', 'AbortError')); return }
          if (coreReady()) { clearTimeout(timeout); resolve() }
          else requestAnimationFrame(check)
        }
        check()
      })
    }

    if (!Live2DAdapter._frameworkReady) {
      const core = (window as any).Live2DCubismCore
      if (core?.Memory?.initializeAmountOfMemory) {
        core.Memory.initializeAmountOfMemory(256 * 1024 * 1024)
      }
      CubismFramework.startUp()
      CubismFramework.initialize()
      Live2DAdapter._frameworkReady = true
    }

    this._gl = this._canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: true
    }) as WebGL2RenderingContext | null

    if (!this._gl) throw new Error('WebGL2 not available')
    this._initialized = true
  }

  async loadModel(modelUrl: string, signal?: AbortSignal): Promise<void> {
    if (this._disposed) throw new DOMException('Aborted', 'AbortError')

    await this.ensureFramework(signal)
    if (signal?.aborted || this._disposed) throw new DOMException('Aborted', 'AbortError')

    if (this._model) { this._model.release(); this._model = null }

    const gl = this._gl!
    this._model = new LAppModel()
    await this._model.load(gl, modelUrl, signal)

    this._projectionMatrix = new CubismMatrix44()
    gl.viewport(0, 0, this._canvas.width, this._canvas.height)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    this._lastTime = performance.now()
    this._renderLoop()
  }

  private _renderLoop = (): void => {
    if (this._disposed) return

    const now = performance.now()
    const deltaTime = Math.min((now - this._lastTime) / 1000, 0.1)
    this._lastTime = now

    if (this._gl && this._model && !this._disposed) {
      try {
        this._gl.clearColor(0, 0, 0, 0)
        this._gl.clear(this._gl.COLOR_BUFFER_BIT)
        this._model.update(deltaTime, this._projectionMatrix!)
      } catch { /* skip render errors */ }
    }

    if (!this._disposed) {
      this._animFrameId = requestAnimationFrame(this._renderLoop)
    }
  }

  setExpression(expression: string): void {
    this._model?.setExpressionByName(EXPRESSION_MAP[expression] || 'neutral')
  }

  startMotion(group: string, index: number = 0, priority: number = 3): void {
    this._model?.startMotionByGroup(group, index, priority)
  }

  setDragging(x: number, y: number): void {
    this._model?.setDragging(x, y)
  }

  hitTest(x: number, y: number): string[] {
    return this._model?.hitTest(x, y) || []
  }

  dispose(): void {
    this._disposed = true
    if (this._animFrameId) { cancelAnimationFrame(this._animFrameId); this._animFrameId = 0 }
    if (this._model) { this._model.release(); this._model = null }
    this._gl = null
    this._initialized = false
  }
}
