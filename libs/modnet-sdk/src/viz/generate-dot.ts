import { DefaultLogCallbackParams, BPEvent } from 'plaited'

type Event = BPEvent & {
  edges: Map<string, Set<string>>
  runs: Set<string>
  step: 'start' | 'step' | 'end'
}

type Events = Map<string, Event>

const mapEvents = ({ logs, map, run }: { logs: DefaultLogCallbackParams[]; map: Events; run: number }) => {
  const start = logs.length - 1
  let next: string | undefined
  for (let step = start; step >= 0; step--) {
    const selected = logs[step].filter((bid) => bid.selected)[0]
    const type = selected.type
    const id = `s${step}_${type}`
    const runId = `run_${run}`
    if (map.has(id)) {
      const node = map.get(id) as Event
      next && node.edges.has(next) ? node.edges.get(next)?.add(runId)
      : next ? node.edges.set(next, new Set([runId]))
      : (node.edges = new Map())
      node.runs.add(runId)
    } else {
      map.set(id, {
        type,
        runs: new Set([runId]),
        ...(next ?
          {
            shape: step === 0 ? 'rectangle' : 'parallelogram',
            step: step === 0 ? 'start' : 'step',
            edges: new Map([[next, new Set([runId])]]),
          }
        : { edges: new Map(), shape: 'rectangle', step: 'end' }),
      })
    }
    next = id
  }
}

export const generateDot = (runs: DefaultLogCallbackParams[][]) => {
  const map: Events = new Map()
  const length = runs.length
  for (let run = 0; run < length; run++) mapEvents({ logs: runs[run], map, run })
  let nodes = ''
  let edges = ''
  for (const [id, event] of map) {
    edges += [...event.edges]
      .map(([next, set]) => `${id} -> ${next} [id="${id}=>${next}" href="${[...set].join(' ')}"]`)
      .join('\n')
    const { type } = event
    nodes += `\n ${id} [
      id=${id}
      shape=rect
      href="${[...event.runs].join(' ')}"
      class=${event.step}
      label=${type}
      ${event.step === 'step' ? 'style=rounded' : ''}
      ]`
  }
  return `digraph erd {
    graph [
      rankdir = "TD"
    ];
    node [
      fontsize = "16"
      fontname = "helvetica"
      shape = "plaintext"
    ];
    edge [
    ];
    ranksep = 1.0
  ${nodes}
  ${edges}
  }`
}
