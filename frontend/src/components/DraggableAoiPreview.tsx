import type { PointerEvent as ReactPointerEvent } from 'react'
import type { StudyBuilderAoi } from '../data/demoStudy'

type DraggableAoiPreviewProps = {
  aois: StudyBuilderAoi[]
  className?: string
  disabled?: boolean
  onAoiChange: (index: number, nextAoi: StudyBuilderAoi) => void
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function moveAoi(aoi: StudyBuilderAoi, x: number, y: number): StudyBuilderAoi {
  return {
    ...aoi,
    x: clamp(x, 0, 1 - aoi.width),
    y: clamp(y, 0, 1 - aoi.height),
  }
}

export function DraggableAoiPreview({
  aois,
  className = '',
  disabled = false,
  onAoiChange,
}: DraggableAoiPreviewProps) {
  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>, index: number) {
    if (disabled) {
      return
    }

    const preview = event.currentTarget.closest<HTMLElement>('[data-aoi-preview]')
    if (!preview) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    const rect = preview.getBoundingClientRect()
    const aoi = aois[index]
    const offsetX = (event.clientX - rect.left) / rect.width - aoi.x
    const offsetY = (event.clientY - rect.top) / rect.height - aoi.y

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextX = (moveEvent.clientX - rect.left) / rect.width - offsetX
      const nextY = (moveEvent.clientY - rect.top) / rect.height - offsetY
      onAoiChange(index, moveAoi(aoi, nextX, nextY))
    }

    function stopDrag() {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopDrag)
      window.removeEventListener('pointercancel', stopDrag)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDrag)
    window.addEventListener('pointercancel', stopDrag)
  }

  return (
    <div className={`aoi-preview ${className}`} aria-label="Normalized key region preview" data-aoi-preview>
      {aois.map((aoi, index) => (
        <button
          type="button"
          key={`${aoi.label}-${index}`}
          className="aoi-preview-box"
          disabled={disabled}
          onPointerDown={(event) => handlePointerDown(event, index)}
          style={{
            left: `${aoi.x * 100}%`,
            top: `${aoi.y * 100}%`,
            width: `${aoi.width * 100}%`,
            height: `${aoi.height * 100}%`,
          }}
        >
          {aoi.label}
        </button>
      ))}
    </div>
  )
}
