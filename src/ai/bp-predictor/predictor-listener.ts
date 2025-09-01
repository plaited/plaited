import type {
  BPEvent,
  BPListener,
  SnapshotMessage,
  Trigger,
  UseFeedback,
  UseSnapshot,
} from '../../behavioral/behavioral.js'
import type { PlaitedTrigger } from '../../behavioral/get-plaited-trigger.js'
import { BPPredictor } from './bp-predictor.js'
import { useSignal } from '../../behavioral/use-signal.js'

/**
 * Creates a BPListener that uses a trained ML model to make predictions
 * about behavioral program state. Integrates with signals for reactive updates.
 */

/**
 * Configuration for creating a predictor listener
 */
export interface PredictorListenerConfig {
  /**
   * The trained predictor model
   */
  predictor: BPPredictor

  /**
   * Threshold for prediction (default 0.5)
   * Events are matched if prediction probability > threshold
   */
  threshold?: number

  /**
   * Signal containing current snapshot
   */
  snapshotSignal?: ReturnType<typeof useSignal<SnapshotMessage | null>>

  /**
   * Optional event type filter
   * Only consider events of these types
   */
  eventTypes?: string[]
}

/**
 * Create a BPListener that uses ML predictions with signals
 * @param config Configuration for the predictor listener
 * @returns A BPListener function that can be used in waitFor, block, or interrupt
 */
export function createPredictorListener(config: PredictorListenerConfig): (event: BPEvent) => boolean {
  const { predictor, threshold = 0.5, snapshotSignal, eventTypes } = config

  return (event: BPEvent): boolean => {
    // Filter by event type if specified
    if (eventTypes && !eventTypes.includes(event.type)) {
      return false
    }

    // Get current snapshot from signal
    const snapshot = snapshotSignal?.get()
    if (!snapshot) {
      return false
    }

    try {
      // Get prediction probability
      const probability = predictor.predictProbability(snapshot)
      return probability > threshold
    } catch (error) {
      console.error('Error in predictor listener:', error)
      return false
    }
  }
}

/**
 * Create a behavioral predictor system with signals and feedback
 * @param predictor Trained predictor model
 * @param useFeedback Behavioral program's feedback hook
 * @param trigger Program trigger for reactive events
 * @param config Additional configuration
 * @returns Listener and control functions
 */
export function createBehavioralPredictorListener(
  predictor: BPPredictor,
  useFeedback: UseFeedback,
  trigger: PlaitedTrigger | Trigger,
  config: {
    threshold?: number
    eventTypes?: string[]
    onPrediction?: (probability: number, matched: boolean) => void
  } = {},
): {
  listener: BPListener
  snapshotSignal: ReturnType<typeof useSignal<SnapshotMessage | null>>
  predictionSignal: ReturnType<typeof useSignal<number>>
  disconnect: () => void
} {
  const { threshold = 0.5, eventTypes, onPrediction } = config

  // Create signals for reactive state
  const snapshotSignal = useSignal<SnapshotMessage | null>(null)
  const predictionSignal = useSignal<number>(0)

  // Connect signals to trigger
  snapshotSignal.listen('SNAPSHOT_CHANGED', trigger)
  predictionSignal.listen('PREDICTION_CHANGED', trigger)

  // Set up feedback handlers
  const disconnect = useFeedback({
    BP_SNAPSHOT: (snapshot: SnapshotMessage) => {
      snapshotSignal.set(snapshot)

      // Make prediction on new snapshot
      try {
        const probability = predictor.predictProbability(snapshot)
        predictionSignal.set(probability)

        if (onPrediction) {
          onPrediction(probability, probability > threshold)
        }
      } catch (error) {
        console.error('Error making prediction:', error)
      }
    },
  })

  const listener: BPListener = (event: BPEvent): boolean => {
    // Filter by event type if specified
    if (eventTypes && !eventTypes.includes(event.type )) {
      return false
    }

    const probability = predictionSignal.get()
    return probability > threshold
  }

  return {
    listener,
    snapshotSignal,
    predictionSignal,
    disconnect,
  }
}

/**
 * Create a composite listener that combines ML prediction with traditional logic
 * @param predictor Trained predictor model
 * @param snapshotSignal Signal containing current snapshot
 * @param fallbackListener Traditional listener to use as fallback
 * @param mode How to combine predictions ('and', 'or', 'ml-only', 'fallback-only')
 * @returns Combined BPListener
 */
export function createHybridListener(
  predictor: BPPredictor,
  snapshotSignal: ReturnType<typeof useSignal<SnapshotMessage | null>>,
  fallbackListener: BPListener,
  mode: 'and' | 'or' | 'ml-only' | 'fallback-only' = 'or',
): BPListener {
  const mlListener = createPredictorListener({
    predictor,
    snapshotSignal,
  })

  return (event: BPEvent): boolean => {
    // mlListener is always a function from createPredictorListener
    const mlResult = mlListener(event)

    // fallbackListener can be string or function
    const fallbackResult =
      typeof fallbackListener === 'string' ? fallbackListener === event.type : fallbackListener(event)

    switch (mode) {
      case 'and':
        return mlResult && fallbackResult
      case 'or':
        return mlResult || fallbackResult
      case 'ml-only':
        return mlResult
      case 'fallback-only':
        return fallbackResult
      default:
        return mlResult || fallbackResult
    }
  }
}

/**
 * Create an adaptive listener that learns from program execution
 * @param initialPredictor Initial trained predictor (optional)
 * @param useSnapshot Hook to subscribe to snapshots
 * @returns Adaptive listener and control functions
 */
export function createAdaptiveListener(
  initialPredictor: BPPredictor | null,
  useSnapshot: UseSnapshot,
): {
  listener: BPListener
  updateModel: (predictor: BPPredictor) => void
  getStats: () => { predictions: number; correct: number; incorrect: number }
  disconnect: () => void
} {
  let predictor = initialPredictor
  let currentSnapshot: SnapshotMessage | null = null

  const stats = {
    predictions: 0,
    correct: 0,
    incorrect: 0,
  }

  // Subscribe to snapshots
  const disconnect = useSnapshot((snapshot: SnapshotMessage) => {
    currentSnapshot = snapshot
  })

  const listener: BPListener = (_event: BPEvent): boolean => {
    if (!predictor || !currentSnapshot) {
      return false
    }

    try {
      const prediction = predictor.predict(currentSnapshot)
      stats.predictions++

      // In a real scenario, you'd validate this prediction later
      // and update stats.correct/incorrect accordingly

      return prediction
    } catch (error) {
      console.error('Error in adaptive listener:', error)
      return false
    }
  }

  const updateModel = (newPredictor: BPPredictor) => {
    predictor = newPredictor
  }

  const getStats = () => ({ ...stats })

  return {
    listener,
    updateModel,
    getStats,
    disconnect,
  }
}