import { describe, expect, it } from 'vitest'
import { toDemoStudy, toStudyConfigurationPayload, toSyntheticStudyConfig } from './studyConfig'
import type { StudyBuilderConfig } from '../data/demoStudy'

const customConfig: StudyBuilderConfig = {
  name: 'Checkout CTA study',
  objective: 'Measure CTA discovery.',
  targetUrl: 'https://example.test/checkout',
  pageLabel: 'Checkout test page',
  tasks: [{ prompt: 'Find the checkout button.' }],
  aois: [
    { label: 'Checkout CTA', semanticType: 'CTA', x: 0.5, y: 0.4, width: 0.2, height: 0.1 },
    { label: 'Plan cards', semanticType: 'pricing', x: 0.2, y: 0.55, width: 0.35, height: 0.2 },
  ],
}

describe('study config transforms', () => {
  it('creates a backend payload with normalized AOIs and task prompts', () => {
    expect(toStudyConfigurationPayload(customConfig)).toEqual({
      name: 'Checkout CTA study',
      objective: 'Measure CTA discovery.',
      target_url: 'https://example.test/checkout',
      tasks: [{ title: 'Task 1', prompt: 'Find the checkout button.', target_url: 'https://example.test/checkout' }],
      aois: [
        {
          label: 'Checkout CTA',
          semantic_type: 'CTA',
          role_key: null,
          selector: null,
          required: true,
          page_url: 'https://example.test/checkout',
          x: 0.5,
          y: 0.4,
          width: 0.2,
          height: 0.1,
          coordinate_space: 'normalized',
        },
        {
          label: 'Plan cards',
          semantic_type: 'pricing',
          role_key: null,
          selector: null,
          required: true,
          page_url: 'https://example.test/checkout',
          x: 0.2,
          y: 0.55,
          width: 0.35,
          height: 0.2,
          coordinate_space: 'normalized',
        },
      ],
    })
  })

  it('converts custom config into visual and synthetic study shapes', () => {
    const demoStudy = toDemoStudy(customConfig)
    const syntheticStudy = toSyntheticStudyConfig(customConfig)

    expect(demoStudy.aois[0]).toEqual(
      expect.objectContaining({ name: 'Checkout CTA', semanticType: 'CTA', x: 50, y: 40 }),
    )
    expect(syntheticStudy.taskPrompt).toBe('Find the checkout button.')
    expect(syntheticStudy.aois[1]).toEqual(expect.objectContaining({ label: 'Plan cards', x: 0.2 }))
  })
})
