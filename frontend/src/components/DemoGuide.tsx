const guideSteps = [
  {
    title: '1. Configure study/tasks/AOIs',
    description:
      'Review or edit the study name, objective, target label or URL, task prompt, and normalized AOI rectangles.',
  },
  {
    title: '2. Run synthetic session',
    description:
      'Use the default Synthetic demo tracker for deterministic, camera-free telemetry that is safe for portfolio review.',
  },
  {
    title: '3. Inspect backend report',
    description:
      'After ingest, check the SQLite-backed report for event counts, AOI hits, fixation demo metrics, TTFF, replay, and quality verdicts.',
  },
  {
    title: '4. Optional browser gaze',
    description:
      'Enable VITE_ENABLE_WEBGAZER=true only for the opt-in browser experiment. It is approximate, browser-dependent, and not medical-grade.',
  },
]

const reportChecks = [
  'Synthetic telemetry remains the default and does not request camera permission.',
  'Quality indicators explain confidence, calibration, low-confidence samples, and missing gaze.',
  'Reports are generated from persisted telemetry, not raw webcam video, frames, screenshots, or image blobs.',
]

export function DemoGuide() {
  return (
    <section className="section-block" aria-labelledby="demo-guide-heading">
      <div className="section-heading">
        <p className="eyebrow">How to evaluate this project</p>
        <h2 id="demo-guide-heading">Demo Guide</h2>
      </div>

      <article className="card demo-guide-panel">
        <div className="demo-guide-grid">
          {guideSteps.map((step) => (
            <section className="demo-guide-step" key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </section>
          ))}
        </div>

        <section className="demo-guide-report" aria-label="What to look for in the report">
          <h3>What to look for in the report</h3>
          <ul>
            {reportChecks.map((check) => (
              <li key={check}>{check}</li>
            ))}
          </ul>
        </section>
      </article>
    </section>
  )
}
