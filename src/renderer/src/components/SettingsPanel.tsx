import { useState, useEffect } from 'react'
import { useAppState } from '../context/AppContext'

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
  const { state, setTheme } = useAppState()
  const [apiUrl, setApiUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [dashboardUrl, setDashboardUrl] = useState('')
  const [alwaysOnTop, setAlwaysOnTop] = useState(true)
  const [autoStart, setAutoStart] = useState(false)
  const [theme, setLocalTheme] = useState('blue')
  const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  useEffect(() => {
    window.api.getSettings().then(s => {
      setApiUrl(s.apiUrl)
      setApiKey(s.apiKey)
      setDashboardUrl(s.dashboardUrl)
      setAlwaysOnTop(s.alwaysOnTop)
      setAutoStart(s.autoStart)
      setLocalTheme(s.theme)
    })
  }, [])

  const handleSave = async () => {
    await window.api.setSettings({ apiUrl, apiKey, dashboardUrl, alwaysOnTop, autoStart, theme })
    onClose()
  }

  const handleTest = async () => {
    setConnStatus('testing')
    await window.api.setSettings({ apiUrl, apiKey, dashboardUrl, alwaysOnTop, autoStart, theme })
    const result = await window.api.checkConnection()
    setConnStatus(result.connected ? 'ok' : 'fail')
  }

  const handleThemeChange = (key: string) => {
    setLocalTheme(key)
    setTheme(key)
  }

  return (
    <div className="settings-panel">
      <h3>设置</h3>

      <label>
        API 地址
        <input type="text" value={apiUrl} onChange={e => setApiUrl(e.target.value)} placeholder="http://localhost:8642/v1" />
      </label>

      <label>
        API Key
        <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="留空则不需要认证" />
      </label>

      <label>
        Dashboard 地址
        <input type="text" value={dashboardUrl} onChange={e => setDashboardUrl(e.target.value)} placeholder="http://localhost:9119" />
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

      {connStatus !== 'idle' && (
        <div className={`connection-status ${connStatus === 'ok' ? 'connected' : 'disconnected'}`}>
          {connStatus === 'testing' && '测试中...'}
          {connStatus === 'ok' && '已连接'}
          {connStatus === 'fail' && '连接失败'}
        </div>
      )}

      <div className="btn-row">
        <button className="btn-test" onClick={handleTest}>测试连接</button>
        <button className="btn-secondary" onClick={onClose}>取消</button>
        <button className="btn-primary" onClick={handleSave}>保存</button>
      </div>
    </div>
  )
}
