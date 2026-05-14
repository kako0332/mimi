import { useState, useEffect } from 'react'
import { useAppState } from '../context/AppContext'
import { MODELS } from '../config/models'

interface Props {
  onClose: () => void
}

const THEMES = [
  { key: 'blue', label: '蓝色', color: '#5a9cf5' },
  { key: 'pink', label: '粉色', color: '#f5769c' },
  { key: 'green', label: '绿色', color: '#5ac5a0' },
  { key: 'purple', label: '紫色', color: '#9b7cf5' }
]

export default function SettingsPanel({ onClose }: Props) {
  const { state, setTheme, setModel } = useAppState()
  const [alwaysOnTop, setAlwaysOnTop] = useState(true)
  const [autoStart, setAutoStart] = useState(false)
  const [theme, setLocalTheme] = useState('blue')

  useEffect(() => {
    window.api.getSettings().then(s => {
      setAlwaysOnTop(s.alwaysOnTop)
      setAutoStart(s.autoStart)
      setLocalTheme(s.theme)
    })
  }, [])

  const handleSave = async () => {
    await window.api.setSettings({ alwaysOnTop, autoStart, theme })
    onClose()
  }

  const handleThemeChange = (key: string) => {
    setLocalTheme(key)
    setTheme(key)
  }

  const handleModelChange = (model: typeof MODELS[number]) => {
    setModel(model)
  }

  return (
    <div className="settings-panel">
      <h3>设置</h3>

      <label>
        宠物模型
        <div className="model-select">
          {MODELS.map(m => (
            <button
              key={m.id}
              className={`model-select-item${state.live2dModelId === m.id ? ' active' : ''}`}
              onClick={() => handleModelChange(m)}
            >
              <span className="model-select-emoji">{m.emoji}</span>
              <span>{m.name}</span>
            </button>
          ))}
        </div>
      </label>

      <div className="toggle-row">
        <span>窗口置顶</span>
        <input type="checkbox" checked={alwaysOnTop} onChange={e => setAlwaysOnTop(e.target.checked)} />
      </div>

      <div className="toggle-row">
        <span>开机自启</span>
        <input type="checkbox" checked={autoStart} onChange={e => setAutoStart(e.target.checked)} />
      </div>

      <div className="theme-row">
        <span>宠物皮肤</span>
        <div className="theme-options">
          {THEMES.map(t => (
            <button
              key={t.key}
              className={`theme-dot ${theme === t.key ? 'active' : ''}`}
              style={{ background: t.color }}
              onClick={() => handleThemeChange(t.key)}
              title={t.label}
            />
          ))}
        </div>
      </div>

      <div className="btn-row">
        <button className="btn-secondary" onClick={onClose}>取消</button>
        <button className="btn-primary" onClick={handleSave}>保存</button>
      </div>
    </div>
  )
}
