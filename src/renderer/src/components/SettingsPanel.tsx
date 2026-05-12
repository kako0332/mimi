import { useState, useEffect } from 'react'

interface Props {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: Props) {
  const [apiUrl, setApiUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [alwaysOnTop, setAlwaysOnTop] = useState(true)
  const [autoStart, setAutoStart] = useState(false)
  const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  useEffect(() => {
    window.api.getSettings().then(s => {
      setApiUrl(s.apiUrl)
      setApiKey(s.apiKey)
      setAlwaysOnTop(s.alwaysOnTop)
      setAutoStart(s.autoStart)
    })
  }, [])

  const handleSave = async () => {
    await window.api.setSettings({ apiUrl, apiKey, alwaysOnTop, autoStart })
    onClose()
  }

  const handleTest = async () => {
    setConnStatus('testing')
    await window.api.setSettings({ apiUrl, apiKey, alwaysOnTop, autoStart })
    const result = await window.api.checkConnection()
    setConnStatus(result.connected ? 'ok' : 'fail')
  }

  return (
    <div className="settings-panel">
      <h3>设置</h3>

      <label>
        API 地址
        <input
          type="text"
          value={apiUrl}
          onChange={e => setApiUrl(e.target.value)}
          placeholder="http://localhost:8642/v1"
        />
      </label>

      <label>
        API Key
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="留空则不需要认证"
        />
      </label>

      <div className="toggle-row">
        <span>窗口置顶</span>
        <input
          type="checkbox"
          checked={alwaysOnTop}
          onChange={e => setAlwaysOnTop(e.target.checked)}
        />
      </div>

      <div className="toggle-row">
        <span>开机自启</span>
        <input
          type="checkbox"
          checked={autoStart}
          onChange={e => setAutoStart(e.target.checked)}
        />
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
