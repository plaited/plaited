import { bSync, bThread, type RulesFunction } from 'plaited'
import { bElement, joinStyles } from 'plaited/ui'
import { styles, hostStyles } from './wizard.css.ts'

type StepState = {
  current: number
  validated: Set<number>
}

/**
 * Enforce sequential navigation - cannot skip ahead without validation.
 * Users can go back to any previous step, but can only advance if current step is validated.
 */
const enforceSequence = (getState: () => StepState): RulesFunction =>
  bThread(
    [
      bSync({
        block: ({ type, detail }) => {
          if (type !== 'goto') return false
          const state = getState()
          const targetStep = (detail as { step: number })?.step
          // Cannot skip ahead more than one step
          if (targetStep > state.current + 1) return true
          // Cannot go to next step if current step isn't validated
          if (targetStep === state.current + 1 && !state.validated.has(state.current)) return true
          return false
        },
      }),
    ],
    true,
  )

/**
 * Block finish until all steps are validated.
 * This ensures users cannot complete the wizard prematurely.
 */
const requireAllValidated = (getState: () => StepState, totalSteps: number): RulesFunction =>
  bThread(
    [
      bSync({
        block: ({ type }) => {
          if (type !== 'finish') return false
          const state = getState()
          return state.validated.size < totalSteps
        },
      }),
    ],
    true,
  )

/**
 * Sequence: goto event triggers render.
 * This ensures UI updates after navigation.
 */
const renderOnNavigate = bThread(
  [bSync({ waitFor: 'goto' }), bSync({ request: { type: 'render' } })],
  true,
)

export const Wizard = bElement({
  tag: 'ui-wizard',
  shadowDom: (
    <div {...styles.container}>
      <nav
        p-target="nav"
        role="navigation"
        aria-label="Wizard steps"
        {...styles.nav}
      ></nav>
      <main
        p-target="content"
        role="region"
        aria-live="polite"
        {...styles.content}
      ></main>
      <footer {...styles.footer}>
        <button
          type="button"
          p-target="prev"
          p-trigger={{ click: 'prev' }}
          {...joinStyles(styles.button, styles.buttonSecondary)}
        >
          Previous
        </button>
        <div>
          <button
            type="button"
            p-target="next"
            p-trigger={{ click: 'next' }}
            {...styles.button}
          >
            Next
          </button>
          <button
            type="button"
            p-target="finish"
            p-trigger={{ click: 'finish' }}
            {...joinStyles(styles.button, styles.buttonSuccess)}
          >
            Finish
          </button>
        </div>
      </footer>
    </div>
  ),
  hostStyles,
  bProgram({ $, bThreads, trigger }) {
    const steps = ['Personal Info', 'Address', 'Review']
    const state: StepState = { current: 0, validated: new Set() }
    const getState = () => state

    bThreads.set({
      enforceSequence: enforceSequence(getState),
      requireAllValidated: requireAllValidated(getState, steps.length),
      renderOnNavigate,
    })

    const renderStep = () => {
      const [content] = $('content')
      const [nav] = $('nav')
      const [prev] = $<HTMLButtonElement>('prev')
      const [next] = $<HTMLButtonElement>('next')
      const [finish] = $<HTMLButtonElement>('finish')

      content?.render(
        <>
          <h2 {...styles.stepTitle}>
            Step {state.current + 1}: {steps[state.current]}
          </h2>
          <p>Content for {steps[state.current]} goes here.</p>
        </>,
      )

      nav?.render(
        <>
          {steps.map((name, i) => (
            <button
              type="button"
              p-trigger={{ click: 'navClick' }}
              data-step={String(i)}
              aria-current={i === state.current ? 'step' : undefined}
              {...styles.navButton}
            >
              {name} {state.validated.has(i) ? '✓' : ''}
            </button>
          ))}
        </>,
      )

      // Update button states
      if (prev) prev.disabled = state.current === 0
      if (next) next.hidden = state.current === steps.length - 1
      if (finish) finish.hidden = state.current !== steps.length - 1
    }

    // Initial render
    renderStep()

    return {
      prev() {
        if (state.current > 0) {
          trigger({ type: 'goto', detail: { step: state.current - 1 } })
        }
      },
      next() {
        // Simulate validation passing for demo
        state.validated.add(state.current)
        trigger({ type: 'goto', detail: { step: state.current + 1 } })
      },
      navClick(evt: MouseEvent) {
        const target = evt.target as HTMLButtonElement
        const step = Number(target.dataset.step)
        if (!Number.isNaN(step)) {
          trigger({ type: 'goto', detail: { step } })
        }
      },
      goto({ step }: { step: number }) {
        state.current = step
      },
      render() {
        renderStep()
      },
      finish() {
        // Mark final step as validated
        state.validated.add(state.current)
        $('content')[0]?.render(
          <>
            <h2 {...styles.stepTitle}>Complete!</h2>
            <p>All steps have been validated. Wizard finished successfully.</p>
          </>,
        )
        $('nav')[0]?.render(<></>)
        $<HTMLButtonElement>('prev')[0]?.setAttribute('hidden', '')
        $<HTMLButtonElement>('finish')[0]?.setAttribute('hidden', '')
      },
    }
  },
})
