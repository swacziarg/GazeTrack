import { useState } from 'react'
import type { StudySaveResult } from '../api/studies'
import type { StudyBuilderAoi, StudyBuilderConfig } from '../data/demoStudy'
import { DraggableAoiPreview } from './DraggableAoiPreview'

type StudySetupWizardProps = {
  value: StudyBuilderConfig
  persistedStudyId?: string | null
  saveResult: StudySaveResult | null
  isSaving: boolean
  onChange: (nextValue: StudyBuilderConfig) => void
  onSave: (mode: 'update' | 'create') => void
}

type WizardStep = 'basics' | 'tasks' | 'regions'

const semanticTypes = ['CTA', 'nav', 'pricing', 'hero', 'footer']
const wizardSteps: Array<{ id: WizardStep; label: string }> = [
  { id: 'basics', label: 'Basics' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'regions', label: 'Key regions' },
]

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

export function StudySetupWizard({
  value,
  persistedStudyId,
  saveResult,
  isSaving,
  onChange,
  onSave,
}: StudySetupWizardProps) {
  const [activeStep, setActiveStep] = useState<WizardStep>('basics')

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

  return (
    <div className="setup-wizard">
      <div className="wizard-tabs" role="tablist" aria-label="Study setup steps">
        {wizardSteps.map((step) => (
          <button
            aria-selected={activeStep === step.id}
            className={activeStep === step.id ? 'active' : ''}
            key={step.id}
            onClick={() => setActiveStep(step.id)}
            role="tab"
            type="button"
          >
            {step.label}
          </button>
        ))}
      </div>

      {activeStep === 'basics' ? (
        <section className="wizard-panel" role="tabpanel">
          <label className="field-control">
            Study name
            <input value={value.name} onChange={(event) => updateField('name', event.target.value)} />
          </label>
          <label className="field-control">
            Page or URL
            <input value={value.targetUrl} onChange={(event) => updateField('targetUrl', event.target.value)} />
          </label>
          <label className="field-control">
            Page label
            <input value={value.pageLabel} onChange={(event) => updateField('pageLabel', event.target.value)} />
          </label>
          <label className="field-control">
            Goal
            <textarea rows={3} value={value.objective} onChange={(event) => updateField('objective', event.target.value)} />
          </label>
        </section>
      ) : null}

      {activeStep === 'tasks' ? (
        <section className="wizard-panel" role="tabpanel">
          <div className="builder-section-heading">
            <h4>Tasks</h4>
            <button type="button" className="secondary-button compact-button" onClick={addTask}>
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
      ) : null}

      {activeStep === 'regions' ? (
        <section className="wizard-panel" role="tabpanel">
          <div className="builder-section-heading">
            <h4>Key regions</h4>
            <span className="status-pill pending">Fixed AOIs</span>
          </div>
          <p className="muted compact-text">
            Add matching page attributes like <code>data-gazetrack-aoi=&quot;primary_cta&quot;</code>, or provide a CSS selector.
          </p>
          <div className="aoi-editor-layout">
            <DraggableAoiPreview aois={value.aois} onAoiChange={updateAoi} />
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
                  <label className="field-control">
                    Role key
                    <input
                      value={aoi.roleKey ?? ''}
                      onChange={(event) => updateAoi(index, { ...aoi, roleKey: event.target.value })}
                    />
                  </label>
                  <label className="field-control">
                    CSS selector
                    <input
                      placeholder={`[data-gazetrack-aoi="${aoi.roleKey ?? 'primary_cta'}"]`}
                      value={aoi.selector ?? ''}
                      onChange={(event) => updateAoi(index, { ...aoi, selector: event.target.value })}
                    />
                  </label>
                  <label className="field-control compact-checkbox">
                    <input
                      checked={aoi.required ?? true}
                      type="checkbox"
                      onChange={(event) => updateAoi(index, { ...aoi, required: event.target.checked })}
                    />
                    Required on real page
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
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <div className="button-row">
        <button type="button" className="primary-button" disabled={isSaving} onClick={() => onSave('update')}>
          {persistedStudyId ? 'Save setup' : 'Save setup'}
        </button>
        <button type="button" className="secondary-button" disabled={isSaving} onClick={() => onSave('create')}>
          Save as new
        </button>
      </div>

      {saveResult ? (
        <p className={saveResult.ok ? 'muted compact-text' : 'backend-unavailable compact'}>{saveResult.message}</p>
      ) : null}
    </div>
  )
}
