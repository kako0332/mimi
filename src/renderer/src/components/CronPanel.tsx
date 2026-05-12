import { useEffect, useState } from 'react'
import { useAppState } from '../context/AppContext'

export default function CronPanel() {
  const { state, refreshJobs } = useAppState()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', schedule: '0 9 * * *', prompt: '' })

  useEffect(() => { refreshJobs() }, [refreshJobs])

  const handleCreate = async () => {
    if (!form.name || !form.prompt) return
    await window.api.createJob({ name: form.name, schedule: form.schedule, prompt: form.prompt })
    setShowForm(false)
    setForm({ name: '', schedule: '0 9 * * *', prompt: '' })
    refreshJobs()
  }

  const handleDelete = async (id: string) => {
    await window.api.deleteJob(id)
    refreshJobs()
  }

  const handleToggle = async (id: string, action: 'pause' | 'resume') => {
    await window.api.toggleJob(id, action)
    refreshJobs()
  }

  const handleRun = async (id: string) => {
    await window.api.toggleJob(id, 'run')
  }

  return (
    <div className="panel-list">
      {!showForm && (
        <button className="cron-add-btn" onClick={() => setShowForm(true)}>+ 新建任务</button>
      )}

      {showForm && (
        <div className="cron-form">
          <input placeholder="任务名称" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Cron 表达式" value={form.schedule} onChange={e => setForm({ ...form, schedule: e.target.value })} />
          <textarea placeholder="提示词" value={form.prompt} onChange={e => setForm({ ...form, prompt: e.target.value })} />
          <div className="cron-form-btns">
            <button className="btn-secondary" onClick={() => setShowForm(false)}>取消</button>
            <button className="btn-primary" onClick={handleCreate}>创建</button>
          </div>
        </div>
      )}

      {state.jobs.length === 0 && !showForm && (
        <div className="panel-empty">暂无定时任务</div>
      )}

      {state.jobs.map(j => (
        <div key={j.id} className="cron-row">
          <div className="cron-info">
            <span className="cron-name">{j.name}</span>
            <span className="cron-schedule">{j.schedule}</span>
          </div>
          <div className="cron-actions">
            {j.enabled !== false ? (
              <button className="cron-action" onClick={() => handleToggle(j.id, 'pause')}>暂停</button>
            ) : (
              <button className="cron-action" onClick={() => handleToggle(j.id, 'resume')}>恢复</button>
            )}
            <button className="cron-action" onClick={() => handleRun(j.id)}>执行</button>
            <button className="cron-action danger" onClick={() => handleDelete(j.id)}>删除</button>
          </div>
        </div>
      ))}
    </div>
  )
}
