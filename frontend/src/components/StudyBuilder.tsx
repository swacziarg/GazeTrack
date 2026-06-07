import type { StudySaveResult } from '../api/studies'
import type { StudyBuilderAoi, StudyBuilderConfig } from '../data/demoStudy'

type StudyBuilderProps = {
  value: StudyBuilderConfig
  persistedStudyId?: string | null
  saveResult: StudySaveResult | null
  isSaving: boolean
  onChange: (nextValue: StudyBuilderConfig) => void
  onSave: (mode: 'update' | 'create') => void
}

const semanticTypes = ['CTA', 'nav', 'pricing', 'hero', 'form', 'content', 'footer']

function clampAoiValue(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.max(0, Math.min(1, value))
}

function updateAoiBounds(aoi: StudyBuilderAoi, key: keyof Pick<StudyBuilderAoi, 'x' | 'y' | 'width' | 'height'>, value: number) {
  const next = { ...aoi, [key]: clampAoiValue(value, aoi[key]) }
  next.width = Math.max(0.01, Math.min(next.width, 1 - next.x))
  next.height = Math.max(0.01, Math.min(next.height, 1 - next.y))
  return next
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

export function StudyBuilder({ value, persistedStudyId, saveResult, isSaving, onChange, onSave }: StudyBuilderProps) {
  function updateField(key: keyof Pick<StudyBuilderConfig, 'name' | 'objective' | 'targetUrl' | 'pageLabel'>, nextValue: string) {
    onChange({ ...value, [key]: nextValue })
  }

  function updateTask(index: number, prompt: string) {
    onChange({
      ...value,
      tasks: value.tasks.map((task, taskIndex) => (taskIndex === index ? { ...task, prompt } : task)),
    })
  }

  function addTask() {
    onChange({ ...value, tasks: [...value.tasks, { prompt: '' }] })
  }

  function removeTask(index: number) {
    if (value.tasks.length === 1) {
      return
    }

    onChange({ ...value, tasks: value.tasks.filter((_, taskIndex) => taskIndex !== index) })
  }

  function updateAoi(index: number, nextAoi: StudyBuilderAoi) {
    onChange({
      ...value,
      aois: value.aois.map((aoi, aoiIndex) => (aoiIndex === index ? nextAoi : aoi)),
    })
  }

  function addAoi() {
    onChange({
      ...value,
      aois: [
        ...value.aois,
        {
          label: `AOI ${value.aois.length + 1}`,
          semanticType: 'content',
          x: 0.2,
          y: 0.2,
          width: 0.24,
          height: 0.14,
        },
      ],
    })
  }

  function removeAoi(index: number) {
    if (value.aois.length === 1) {
      return
    }

    onChange({ ...value, aois: value.aois.filter((_, aoiIndex) => aoiIndex !== index) })
  }

  return (
    <article className="card study-builder-panel">
      <div className="card-header">
        <div>
          <p className="eyebrow">Study Builder</p>
          <h3>Configure synthetic study</h3>
        </div>
        <span className={`status-pill ${saveResult?.ok ? 'ok' : 'pending'}`}>
          {isSaving ? 'Saving' : saveResult?.ok ? 'Saved' : persistedStudyId ? 'Editable' : 'Local'}
        </span>
      </div>

      <p className="privacy-note compact">
        Study setup stores text prompts and normalized rectangles only. No screenshots, webcam frames, or image payloads
        are accepted by this flow.
      </p>

      <div className="builder-form-grid">
        <label className="field-control">
          Study name
          <input value={value.name} onChange={(event) => updateField('name', event.target.value)} />
        </label>
        <label className="field-control">
          Target page URL or demo label
          <input value={value.targetUrl} onChange={(event) => updateField('targetUrl', event.target.value)} />
        </label>
        <label className="field-control wide-field">
          Objective
          <textarea rows={3} value={value.objective} onChange={(event) => updateField('objective', event.target.value)} />
        </label>
      </div>

      <section className="builder-section">
        <div className="builder-section-heading">
          <h4>Task prompts</h4>
          <button type="button" className="secondary-button" onClick={addTask}>
            Add task
          </button>
        </div>
        <div className="task-editor-list">
          {value.tasks.map((task, index) => (
            <div className="task-editor-row" key={`task-${index}`}>
              <label className="field-control">
                Task {index + 1}
                <input value={task.prompt} onChange={(event) => updateTask(index, event.target.value)} />
              </label>
              <button
                type="button"
                className="secondary-button compact-button"
                disabled={value.tasks.length === 1}
                onClick={() => removeTask(index)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="builder-section">
        <div className="builder-section-heading">
          <h4>AOIs</h4>
          <button type="button" className="secondary-button" onClick={addAoi}>
            Add AOI
          </button>
        </div>
        <div className="aoi-editor-layout">
          <div className="aoi-preview" aria-label="Normalized AOI preview">
            {value.aois.map((aoi) => (
              <span
                key={`${aoi.label}-${aoi.x}-${aoi.y}`}
                className="aoi-preview-box"
                style={{
                  left: `${aoi.x * 100}%`,
                  top: `${aoi.y * 100}%`,
                  width: `${aoi.width * 100}%`,
                  height: `${aoi.height * 100}%`,
                }}
              >
                {aoi.label}
              </span>
            ))}
          </div>
          <div className="aoi-editor-list">
            {value.aois.map((aoi, index) => (
              <div className="aoi-editor-row" key={`aoi-${index}`}>
                <label className="field-control">
                  Label
                  <input value={aoi.label} onChange={(event) => updateAoi(index, { ...aoi, label: event.target.value })} />
                </label>
                <label className="field-control">
                  Type
                  <select
                    value={aoi.semanticType ?? ''}
                    onChange={(event) => updateAoi(index, { ...aoi, semanticType: event.target.value || undefined })}
                  >
                    <option value="">Custom</option>
                    {semanticTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                {(['x', 'y', 'width', 'height'] as const).map((key) => (
                  <label className="field-control compact-number" key={key}>
                    {key}
                    <input
                      min="0"
                      max="1"
                      step="0.01"
                      type="number"
                      value={aoi[key]}
                      onChange={(event) => updateAoi(index, updateAoiBounds(aoi, key, Number(event.target.value)))}
                    />
                    <span>{formatPercent(aoi[key])}</span>
                  </label>
                ))}
                <button
                  type="button"
                  className="secondary-button compact-button"
                  disabled={value.aois.length === 1}
                  onClick={() => removeAoi(index)}
                >
                  Remove AOI
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="button-row">
        <button type="button" className="primary-button" disabled={isSaving} onClick={() => onSave('update')}>
          {persistedStudyId ? 'Save study' : 'Save study'}
        </button>
        <button type="button" className="secondary-button" disabled={isSaving} onClick={() => onSave('create')}>
          Save as new study
        </button>
      </div>

      {saveResult ? (
        <p className={saveResult.ok ? 'muted compact-text' : 'backend-unavailable compact'}>{saveResult.message}</p>
      ) : null}
    </article>
  )
}
