/**
 * Live2DAdapter — Unified API for React components to interact with Live2D models.
 * Wraps the CubismWebFramework into a simple, clean interface.
 */

import { CubismFramework } from '../framework/live2dcubismframework'
import { CubismUserModel } from '../framework/model/cubismusermodel'
import { CubismModelSettingJson } from '../framework/cubismmodelsettingjson'
import { CubismEyeBlink } from '../framework/effect/cubismeyeblink'
import { CubismBreath, BreathParameterData } from '../framework/effect/cubismbreath'
import { CubismExpressionMotion } from '../framework/motion/cubismexpressionmotion'
import { CubismMotion } from '../framework/motion/cubismmotion'
import { CubismDefaultParameterId } from '../framework/cubismdefaultparameterid'
import { CubismIdHandle } from '../framework/id/cubismid'
import { CubismRenderer_WebGL } from '../framework/rendering/cubismrenderer_webgl'
import { EXPRESSION_MAP } from './expressionMap'

/**
 * LAppModel — extends CubismUserModel with model loading and rendering logic.
 */
class LAppModel extends CubismUserModel {
  private _setting: CubismModelSettingJson | null = null
  private _homeDir: string = ''
  private _blinkCtrl: CubismEyeBlink | null = null
  private _breathCtrl: CubismBreath | null = null
  private _exprMap: Map<string, CubismExpressionMotion> = new Map()
  private _motionMap: Map<string, CubismMotion[]> = new Map()

  /**
   * Load a Live2D model from a model3.json URL
   */
  async load(modelUrl: string): Promise<void> {
    // Fetch model3.json
    const resp = await fetch(modelUrl)
    const arrayBuffer = await resp.arrayBuffer()
    const setting = new CubismModelSettingJson(arrayBuffer, arrayBuffer.byteLength)
    this._setting = setting

    // Derive base URL for relative paths
    const url = new URL(modelUrl, window.location.href)
    this._homeDir = url.href.substring(0, url.href.lastIndexOf('/') + 1)

    // Load Moc
    const mocFileName = setting.getModelFileName()
    if (mocFileName) {
      const mocResp = await fetch(this._homeDir + mocFileName)
      const mocBuffer = await mocResp.arrayBuffer()
      this.loadModel(mocBuffer)
    }

    // Load textures via renderer
    const textureCount = setting.getTextureCount()
    if (textureCount > 0) {
      this.setupRenderer()
      for (let i = 0; i < textureCount; i++) {
        const texName = setting.getTextureFileName(i)
        if (!texName) continue
        await this.loadTexture(i, this._homeDir + texName)
      }
    }

    // Setup model matrix
    if (this._model) {
      this._modelMatrix.setWidth(this._model.getCanvasWidth())
      this._modelMatrix.setHeight(this._model.getCanvasHeight())
    }

    // Load expressions
    const expressionCount = setting.getExpressionCount()
    for (let i = 0; i < expressionCount; i++) {
      const expName = setting.getExpressionName(i)
      const expFile = setting.getExpressionFileName(i)
      if (!expFile) continue
      try {
        const expResp = await fetch(this._homeDir + expFile)
        const expBuffer = await expResp.arrayBuffer()
        const motion = this.loadExpression(expBuffer, expBuffer.byteLength, expName)
        if (motion && motion instanceof CubismExpressionMotion) {
          this._exprMap.set(expName, motion)
        }
      } catch (e) {
        console.warn(`Failed to load expression: ${expName}`, e)
      }
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
          const motionResp = await fetch(this._homeDir + motionFile)
          const motionBuffer = await motionResp.arrayBuffer()
          const motion = this.loadMotion(
            motionBuffer, motionBuffer.byteLength,
            `${group}_${m}`,
            undefined, undefined,
            setting, group, m
          )
          if (motion) {
            motions.push(motion)
          }
        } catch (e) {
          console.warn(`Failed to load motion: ${group}[${m}]`, e)
        }
      }
      this._motionMap.set(group, motions)
    }

    // Setup eye blink
    this._blinkCtrl = CubismEyeBlink.create(setting)

    // Setup breath
    this._breathCtrl = CubismBreath.create()
    const breathParameters = new Array<BreathParameterData>()
    const breathId = CubismFramework.getIdManager().getId(
      CubismDefaultParameterId.Breath
    )
    breathParameters.push({
      parameterId: breathId,
      offset: 0.0,
      peak: 0.5,
      cycle: 3.235,
      weight: 0.5
    })
    this._breathCtrl.setParameters(breathParameters)

    // Load physics
    const physicsFile = setting.getPhysicsFileName()
    if (physicsFile) {
      try {
        const physResp = await fetch(this._homeDir + physicsFile)
        const physBuffer = await physResp.arrayBuffer()
        this.loadPhysics(physBuffer, physBuffer.byteLength)
      } catch (e) {
        console.warn('Failed to load physics', e)
      }
    }

    // Load pose
    const poseFile = setting.getPoseFileName()
    if (poseFile) {
      try {
        const poseResp = await fetch(this._homeDir + poseFile)
        const poseBuffer = await poseResp.arrayBuffer()
        this.loadPose(poseBuffer, poseBuffer.byteLength)
      } catch (e) {
        console.warn('Failed to load pose', e)
      }
    }

    this.setInitialized(true)
  }

  /**
   * Setup WebGL renderer
   */
  private setupRenderer(): void {
    if (!this._model) return
    // @ts-ignore — framework uses internal renderer assignment
    const renderer = new CubismRenderer_WebGL()
    // @ts-ignore
    renderer.initialize(this._model)
    // @ts-ignore — isPremultipliedAlpha is a setter in the framework
    renderer.isPremultipliedAlpha(true)
  }

  /**
   * Load a texture into the renderer
   */
  private async loadTexture(index: number, url: string): Promise<void> {
    const resp = await fetch(url)
    const blob = await resp.blob()
    const bitmap = await createImageBitmap(blob)

    const renderer = this.getRenderer() as CubismRenderer_WebGL
    if (!renderer) return
    renderer.bindTexture(index, bitmap)
  }

  /**
   * Set expression by name
   */
  setExpressionByName(expressionName: string): void {
    const motion = this._exprMap.get(expressionName)
    if (!motion) return
    if (this._expressionManager) {
      this._expressionManager.startMotion(motion, false)
    }
  }

  /**
   * Start a motion by group and index
   */
  startMotionByGroup(group: string, index: number = 0, priority: number = 3): void {
    const motions = this._motionMap.get(group)
    if (!motions || index >= motions.length) return
    if (this._motionManager) {
      this._motionManager.startMotion(motions[index], false, priority as any)
    }
  }

  /**
   * Per-frame update
   */
  update(deltaTimeSeconds: number): void {
    if (!this._model || !this.isInitialized()) return

    if (this._blinkCtrl) {
      this._blinkCtrl.updateParameters(this._model, deltaTimeSeconds)
    }
    if (this._breathCtrl) {
      this._breathCtrl.updateParameters(this._model, deltaTimeSeconds)
    }
    if (this._physics) {
      this._physics.evaluate(this._model, deltaTimeSeconds)
    }
    if (this._pose) {
      this._pose.updateParameters(this._model, deltaTimeSeconds)
    }

    this._model.update()

    const renderer = this.getRenderer() as CubismRenderer_WebGL
    if (renderer) {
      renderer.drawModel()
    }
  }

  /**
   * Hit test at given coordinates
   */
  hitTest(x: number, y: number): string[] {
    if (!this._setting || !this._model) return []
    const hitAreas: string[] = []
    const count = this._setting.getHitAreasCount()
    for (let i = 0; i < count; i++) {
      const id = this._setting.getHitAreaId(i)
      const name = this._setting.getHitAreaName(i)
      if (this.isHit(id, x, y)) {
        hitAreas.push(name)
      }
    }
    return hitAreas
  }

  override release(): void {
    if (this._blinkCtrl) {
      CubismEyeBlink.delete(this._blinkCtrl)
      this._blinkCtrl = null
    }
    if (this._breathCtrl) {
      CubismBreath.delete(this._breathCtrl)
      this._breathCtrl = null
    }
  }
}

/**
 * Live2DAdapter — React-friendly wrapper for Live2D model management.
 */
export class Live2DAdapter {
  private _canvas: HTMLCanvasElement
  private _gl: WebGL2RenderingContext | null = null
  private _model: LAppModel | null = null
  private _animFrameId: number = 0
  private _lastTime: number = 0
  private _initialized: boolean = false
  private _disposed: boolean = false

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas
  }

  private async ensureFramework(): Promise<void> {
    if (this._initialized) return

    // Wait for Live2D Core to be loaded
    const coreReady = () => typeof (window as any).Live2DCubismCore !== 'undefined'
    if (!coreReady()) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Live2D Core load timeout')), 10000)
        const check = () => {
          if (coreReady()) {
            clearTimeout(timeout)
            resolve()
          } else {
            requestAnimationFrame(check)
          }
        }
        check()
      })
    }

    // Initialize Cubism Framework
    CubismFramework.startUp()
    CubismFramework.initialize()

    // Get WebGL2 context
    this._gl = this._canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true
    }) as WebGL2RenderingContext | null

    if (!this._gl) {
      throw new Error('WebGL2 is not supported')
    }

    this._initialized = true
  }

  async loadModel(modelUrl: string): Promise<void> {
    await this.ensureFramework()

    if (this._model) {
      this._model.release()
    }

    this._model = new LAppModel()
    await this._model.load(modelUrl)

    const gl = this._gl!
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

    if (this._gl && this._model) {
      this._gl.clearColor(0, 0, 0, 0)
      this._gl.clear(this._gl.COLOR_BUFFER_BIT)

      const projection = this._model.getModelMatrix()
      if (projection) {
        projection.setWidth(this._canvas.width)
        projection.setHeight(this._canvas.height)
      }

      this._model.update(deltaTime)
    }

    this._animFrameId = requestAnimationFrame(this._renderLoop)
  }

  setExpression(expression: string): void {
    const live2dExp = EXPRESSION_MAP[expression] || 'neutral'
    this._model?.setExpressionByName(live2dExp)
  }

  setTalking(talking: boolean): void {
    if (talking) {
      this._model?.startMotionByGroup('Idle', 0, 2)
    }
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

  getCanvas(): HTMLCanvasElement {
    return this._canvas
  }

  dispose(): void {
    this._disposed = true
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId)
      this._animFrameId = 0
    }
    if (this._model) {
      this._model.release()
      this._model = null
    }
    this._gl = null
    if (this._initialized) {
      try { CubismFramework.dispose() } catch { /* ignore */ }
      this._initialized = false
    }
  }
}
