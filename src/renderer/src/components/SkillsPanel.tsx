import { useEffect } from 'react'
import { useAppState } from '../context/AppContext'

export default function SkillsPanel() {
  const { state, refreshSkills } = useAppState()

  useEffect(() => { refreshSkills() }, [refreshSkills])

  const handleToggle = async (name: string, enabled: boolean) => {
    await window.api.toggleSkill(name, !enabled)
    refreshSkills()
  }

  if (state.skills.length === 0) {
    return <div className="panel-empty">暂无技能数据<br /><span className="panel-hint">请确认 Hermes Dashboard 已启动</span></div>
  }

  return (
    <div className="panel-list">
      {state.skills.map(s => (
        <div key={s.name} className="skill-row">
          <span className="skill-name">{s.name}</span>
          <label className="switch">
            <input type="checkbox" checked={s.enabled} onChange={() => handleToggle(s.name, s.enabled)} />
            <span className="switch-slider" />
          </label>
        </div>
      ))}
    </div>
  )
}
