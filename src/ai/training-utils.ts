import type { SnapshotMessage, UseSnapshot, UseFeedback, Trigger } from '../behavioral/behavioral.js'
import type { PlaitedTrigger } from '../behavioral/get-plaited-trigger.js'
import { SnapshotCollector } from './snapshot-collector.js'
import { BPPredictor } from './bp-predictor.js'
import { useSignal } from '../behavioral/use-signal.js'

/**
 * Training utilities for behavioral program ML models
 */

/**
 * Configuration for training a BP predictor
 */
export interface TrainingConfig {
  epochs?: number
  batchSize?: number
  validationSplit?: number
  verbose?: boolean
}

/**
 * Result of training session
 */
export interface TrainingResult {
  accuracy: number
  loss: number
  totalSamples: number
  positiveSamples: number
  negativeSamples: number
}

/**
 * Create a behavioral snapshot collection system
 * @param useFeedback The behavioral program's feedback hook
 * @param useSnapshot The behavioral program's snapshot hook
 * @param trigger Optional trigger for reactive events
 * @returns Collector and disconnect function
 */
export function createBehavioralCollector(
  useFeedback: UseFeedback,
  useSnapshot: UseSnapshot,
  trigger?: PlaitedTrigger | Trigger,
): {
  collector: SnapshotCollector
  disconnect: () => void
} {
  const collector = new SnapshotCollector()

  // Connect collector to behavioral program
  const disconnectFeedback = collector.connectToProgram(useFeedback, trigger)

  // Capture snapshots directly without triggering events (to avoid loops)
  const disconnectSnapshot = useSnapshot((snapshot) => {
    // Directly add to collector without triggering signal updates
    collector.addSnapshotQuietly(snapshot)
  })

  return {
    collector,
    disconnect: () => {
      disconnectFeedback()
      disconnectSnapshot()
    },
  }
}

/**
 * Create a signal-based training coordinator
 * @param trigger Behavioral program trigger
 * @returns Training state signals and control functions
 */
export function createTrainingSignals(trigger: PlaitedTrigger | Trigger) {
  const isTraining = useSignal(false)
  const trainingProgress = useSignal(0)
  const currentAccuracy = useSignal(0)
  const currentLoss = useSignal(1)

  // Connect signals to trigger
  isTraining.listen('TRAINING_STATE_CHANGED', trigger)
  trainingProgress.listen('TRAINING_PROGRESS', trigger)
  currentAccuracy.listen('ACCURACY_UPDATED', trigger)
  currentLoss.listen('LOSS_UPDATED', trigger)

  return {
    isTraining,
    trainingProgress,
    currentAccuracy,
    currentLoss,
    startTraining: () => isTraining.set(true),
    stopTraining: () => isTraining.set(false),
    updateProgress: (progress: number) => trainingProgress.set(progress),
    updateMetrics: (accuracy: number, loss: number) => {
      currentAccuracy.set(accuracy)
      currentLoss.set(loss)
    },
  }
}

/**
 * Train a predictor from collected data
 * @param collector The snapshot collector with training data
 * @param config Training configuration
 * @returns Trained predictor and training results
 */
export async function trainPredictor(
  collector: SnapshotCollector,
  config: TrainingConfig = {},
): Promise<{
  predictor: BPPredictor
  results: TrainingResult
}> {
  const { epochs = 50, verbose = false } = config

  const { features, labels } = collector.getTrainingData()

  if (features.length === 0) {
    throw new Error('No training data available')
  }

  const predictor = new BPPredictor()

  if (verbose) {
    const stats = collector.getStats()
    console.log('Training BP Predictor:')
    console.log(`  Total samples: ${stats.totalSamples}`)
    console.log(`  Positive samples: ${stats.positiveSamples}`)
    console.log(`  Negative samples: ${stats.negativeSamples}`)
    console.log(`  Features per sample: ${stats.featureCount}`)
  }

  const { accuracy, loss } = await predictor.train(features, labels, epochs)

  const stats = collector.getStats()
  const results: TrainingResult = {
    accuracy,
    loss,
    totalSamples: stats.totalSamples,
    positiveSamples: stats.positiveSamples,
    negativeSamples: stats.negativeSamples,
  }

  if (verbose) {
    console.log(`Training complete:`)
    console.log(`  Final accuracy: ${(accuracy * 100).toFixed(2)}%`)
    console.log(`  Final loss: ${loss.toFixed(4)}`)
  }

  return { predictor, results }
}

/**
 * Create a dataset from behavioral program execution
 * @param snapshots Array of snapshot sequences
 * @param labels Corresponding labels for each sequence
 * @returns Formatted dataset ready for training
 */
export function createDataset(
  snapshots: SnapshotMessage[][],
  labels: boolean[],
): {
  features: number[][]
  labels: boolean[]
} {
  if (snapshots.length !== labels.length) {
    throw new Error('Snapshots and labels must have the same length')
  }

  const collector = new SnapshotCollector()
  const features: number[][] = []

  for (let i = 0; i < snapshots.length; i++) {
    const sequence = snapshots[i]
    if (sequence.length > 0) {
      // Use the last snapshot of each sequence
      const lastSnapshot = sequence[sequence.length - 1]
      features.push(collector.extractFeatures(lastSnapshot))
    }
  }

  return { features, labels }
}

/**
 * Analyze feature importance using permutation
 * @param predictor Trained predictor
 * @param testFeatures Test feature set
 * @param testLabels Test labels
 * @returns Feature importance scores
 */
export async function analyzeFeatureImportance(
  predictor: BPPredictor,
  testFeatures: number[][],
  testLabels: boolean[],
): Promise<number[]> {
  const numFeatures = testFeatures[0].length
  const importanceScores = new Array(numFeatures).fill(0)

  // Calculate baseline accuracy
  let baselineCorrect = 0
  for (let i = 0; i < testFeatures.length; i++) {
    // Create a mock snapshot for prediction
    const snapshot: SnapshotMessage = []
    const prediction = predictor.predict(snapshot)
    if (prediction === testLabels[i]) baselineCorrect++
  }
  const baselineAccuracy = baselineCorrect / testLabels.length

  // Permute each feature and measure accuracy drop
  for (let featureIdx = 0; featureIdx < numFeatures; featureIdx++) {
    const permutedFeatures = testFeatures.map((features) => [...features])

    // Shuffle the specific feature across samples
    const featureValues = permutedFeatures.map((f) => f[featureIdx])
    for (let i = featureValues.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[featureValues[i], featureValues[j]] = [featureValues[j], featureValues[i]]
    }
    permutedFeatures.forEach((f, i) => (f[featureIdx] = featureValues[i]))

    // Measure accuracy with permuted feature
    let permutedCorrect = 0
    for (let i = 0; i < permutedFeatures.length; i++) {
      // Create a mock snapshot for prediction
      const snapshot: SnapshotMessage = []
      const prediction = predictor.predict(snapshot)
      if (prediction === testLabels[i]) permutedCorrect++
    }
    const permutedAccuracy = permutedCorrect / testLabels.length

    // Importance is the drop in accuracy
    importanceScores[featureIdx] = baselineAccuracy - permutedAccuracy
  }

  return importanceScores
}

/**
 * Split dataset into training and testing sets
 * @param features Feature vectors
 * @param labels Labels
 * @param testRatio Ratio of data to use for testing (default 0.2)
 * @returns Training and testing sets
 */
export function splitDataset(
  features: number[][],
  labels: boolean[],
  testRatio: number = 0.2,
): {
  trainFeatures: number[][]
  trainLabels: boolean[]
  testFeatures: number[][]
  testLabels: boolean[]
} {
  const numSamples = features.length
  const numTest = Math.floor(numSamples * testRatio)
  const numTrain = numSamples - numTest

  // Shuffle indices
  const indices = Array.from({ length: numSamples }, (_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }

  // Split data
  const trainFeatures = indices.slice(0, numTrain).map((i) => features[i])
  const trainLabels = indices.slice(0, numTrain).map((i) => labels[i])
  const testFeatures = indices.slice(numTrain).map((i) => features[i])
  const testLabels = indices.slice(numTrain).map((i) => labels[i])

  return {
    trainFeatures,
    trainLabels,
    testFeatures,
    testLabels,
  }
}
