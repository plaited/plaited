import type { SnapshotMessage, Trigger, UseFeedback } from '../behavioral/behavioral.js'
import type { PlaitedTrigger } from '../behavioral/get-plaited-trigger.js'
import { useSignal } from '../behavioral/use-signal.js'

/**
 * Collects snapshots from behavioral program execution for training ML models.
 * Transforms snapshots into feature vectors and labels for supervised learning.
 * Integrates with behavioral programs via signals and feedback handlers.
 */
export class SnapshotCollector {
  private snapshots: SnapshotMessage[] = []
  private labels: boolean[] = []
  private currentSequence: SnapshotMessage[] = []

  // Signal for reactive snapshot updates
  readonly snapshotSignal = useSignal<SnapshotMessage | null>(null)
  readonly sequenceSignal = useSignal<SnapshotMessage[]>([])

  /**
   * Add a snapshot to the current sequence
   */
  addSnapshot(snapshot: SnapshotMessage): void {
    this.currentSequence.push(snapshot)
    // Only update signals if they don't cause loops
    if (!this.suppressSignalUpdates) {
      this.sequenceSignal.set([...this.currentSequence])
      this.snapshotSignal.set(snapshot)
    }
  }

  private suppressSignalUpdates = false

  /**
   * Add snapshot without triggering signal updates (for use in callbacks)
   */
  addSnapshotQuietly(snapshot: SnapshotMessage): void {
    this.suppressSignalUpdates = true
    this.addSnapshot(snapshot)
    this.suppressSignalUpdates = false
  }

  /**
   * Complete the current sequence and label it
   * @param label True for positive outcome, false for negative
   */
  completeSequence(label: boolean): void {
    if (this.currentSequence.length > 0) {
      // Store the last snapshot of the sequence with its label
      this.snapshots.push(this.currentSequence[this.currentSequence.length - 1])
      this.labels.push(label)
      this.currentSequence = []
      this.sequenceSignal.set([])
    }
  }

  /**
   * Connect collector to behavioral program via feedback
   * @param useFeedback The behavioral program's feedback hook
   * @param trigger Optional trigger for reactive events
   */
  connectToProgram(useFeedback: UseFeedback, trigger?: PlaitedTrigger | Trigger): () => void {
    // Set up signal listeners if trigger provided
    if (trigger) {
      this.snapshotSignal.listen('SNAPSHOT_UPDATED', trigger)
      this.sequenceSignal.listen('SEQUENCE_UPDATED', trigger)
    }

    // Connect to behavioral program feedback
    return useFeedback({
      BP_SNAPSHOT: (snapshot: SnapshotMessage) => {
        this.addSnapshot(snapshot)
      },
      LABEL_SEQUENCE: ({ label }: { label: boolean }) => {
        this.completeSequence(label)
      },
      CLEAR_SEQUENCE: () => {
        this.currentSequence = []
        this.sequenceSignal.set([])
      },
    })
  }

  /**
   * Extract features from a snapshot for ML model input
   */
  extractFeatures(snapshot: SnapshotMessage): number[] {
    const features: number[] = []

    // Basic counts
    const totalBids = snapshot.length
    const selectedBids = snapshot.filter((s) => s.selected).length
    const blockedBids = snapshot.filter((s) => s.blockedBy).length
    const interruptingBids = snapshot.filter((s) => s.interrupts).length
    const triggerBids = snapshot.filter((s) => s.trigger).length

    features.push(totalBids)
    features.push(selectedBids)
    features.push(blockedBids)
    features.push(interruptingBids)
    features.push(triggerBids)

    // Priority statistics
    const priorities = snapshot.map((s) => s.priority)
    if (priorities.length > 0) {
      features.push(Math.min(...priorities)) // Min priority
      features.push(Math.max(...priorities)) // Max priority
      features.push(priorities.reduce((a, b) => a + b, 0) / priorities.length) // Avg priority
    } else {
      features.push(0, 0, 0)
    }

    // Event type diversity (unique event types)
    const uniqueTypes = new Set(snapshot.map((s) => s.type))
    features.push(uniqueTypes.size)

    // Thread diversity (unique threads)
    const uniqueThreads = new Set(snapshot.map((s) => s.thread))
    features.push(uniqueThreads.size)

    // Blocking relationships
    const blockingThreads = new Set(snapshot.filter((s) => s.blockedBy).map((s) => s.blockedBy))
    features.push(blockingThreads.size)

    // Ratio features
    features.push(totalBids > 0 ? blockedBids / totalBids : 0) // Block ratio
    features.push(totalBids > 0 ? triggerBids / totalBids : 0) // Trigger ratio

    return features
  }

  /**
   * Get all collected training data
   */
  getTrainingData(): { features: number[][]; labels: boolean[] } {
    const features = this.snapshots.map((snapshot) => this.extractFeatures(snapshot))
    return { features, labels: this.labels }
  }

  /**
   * Clear all collected data
   */
  clear(): void {
    this.snapshots = []
    this.labels = []
    this.currentSequence = []
  }

  /**
   * Get statistics about collected data
   */
  getStats(): {
    totalSamples: number
    positiveSamples: number
    negativeSamples: number
    featureCount: number
  } {
    const positiveSamples = this.labels.filter((l) => l).length
    return {
      totalSamples: this.labels.length,
      positiveSamples,
      negativeSamples: this.labels.length - positiveSamples,
      featureCount: this.snapshots.length > 0 ? this.extractFeatures(this.snapshots[0]).length : 13,
    }
  }
}
