import { test, expect } from 'bun:test'
import { behavioral, bThread, bSync } from '../../behavioral/behavioral.js'
import { SnapshotCollector } from '../snapshot-collector.js'
import { BPPredictor } from '../bp-predictor.js'
import { createBehavioralCollector, trainPredictor, splitDataset, createTrainingSignals } from '../training-utils.js'
import { createBehavioralPredictorListener } from '../predictor-listener.js'
import type { SnapshotMessage } from '../../behavioral/behavioral.js'

test('SnapshotCollector integrates with behavioral program via feedback', async () => {
  const { bThreads, trigger, useFeedback, useSnapshot } = behavioral()
  const collector = new SnapshotCollector()

  // Connect collector to behavioral program
  const disconnect = collector.connectToProgram(useFeedback, trigger)

  // Set up threads that generate events
  bThreads.set({
    'test-thread': bThread([
      bSync({ request: { type: 'START' } }),
      bSync({ request: { type: 'PROCESS' } }),
      bSync({ request: { type: 'END' } }),
    ]),
  })

  // Set up snapshot capture directly (without triggering to avoid loops)
  const snapshots: SnapshotMessage[] = []
  const disconnectSnapshot = useSnapshot((snapshot) => {
    snapshots.push(snapshot)
    collector.addSnapshotQuietly(snapshot)
  })

  // Set up labeling via feedback
  useFeedback({
    END: () => {
      // Use setTimeout to avoid triggering in the same cycle
      setTimeout(() => {
        trigger({ type: 'LABEL_SEQUENCE', detail: { label: true } })
      }, 0)
    },
  })

  // Run the program
  trigger({ type: 'RUN' })

  // Wait for execution
  await new Promise((resolve) => setTimeout(resolve, 50))

  // Check that collector received data
  const stats = collector.getStats()
  expect(stats.totalSamples).toBeGreaterThan(0)

  // Check that snapshots were collected
  expect(snapshots.length).toBeGreaterThan(0)

  disconnect()
  disconnectSnapshot()
})

test('Training signals coordinate with behavioral program', async () => {
  const { trigger, useFeedback } = behavioral()

  // Create training signals
  const signals = createTrainingSignals(trigger)

  // Track signal updates via feedback
  const updates: string[] = []
  useFeedback({
    TRAINING_STATE_CHANGED: () => {
      updates.push('training-state')
    },
    TRAINING_PROGRESS: () => {
      updates.push('progress')
    },
    ACCURACY_UPDATED: () => {
      updates.push('accuracy')
    },
    LOSS_UPDATED: () => {
      updates.push('loss')
    },
  })

  // Trigger training updates
  signals.startTraining()
  signals.updateProgress(50)
  signals.updateMetrics(0.85, 0.15)
  signals.stopTraining()

  // Wait for events to propagate
  await new Promise((resolve) => setTimeout(resolve, 10))

  // Check that events were triggered
  expect(updates).toContain('training-state')
  expect(updates).toContain('progress')
  expect(updates).toContain('accuracy')
  expect(updates).toContain('loss')

  // Check signal values
  expect(signals.isTraining.get()).toBe(false)
  expect(signals.trainingProgress.get()).toBe(50)
  expect(signals.currentAccuracy.get()).toBe(0.85)
  expect(signals.currentLoss.get()).toBe(0.15)
})

test('BPPredictor trains with behavioral program data collection', async () => {
  const { bThreads, trigger, useFeedback, useSnapshot } = behavioral()

  // Create behavioral collector
  const { collector, disconnect } = createBehavioralCollector(useFeedback, useSnapshot, trigger)

  // Define a simple behavioral program
  bThreads.set({
    generator: bThread([
      bSync({ request: { type: 'START' } }),
      bSync({ request: { type: 'ACTION_A' } }),
      bSync({ request: { type: 'ACTION_B' } }),
      bSync({ request: { type: 'SUCCESS' } }),
    ]),
  })

  // Label based on outcome
  useFeedback({
    SUCCESS: () => {
      trigger({ type: 'LABEL_SEQUENCE', detail: { label: true } })
    },
    FAILURE: () => {
      trigger({ type: 'LABEL_SEQUENCE', detail: { label: false } })
    },
  })

  // Generate training data
  for (let i = 0; i < 10; i++) {
    trigger({ type: 'RUN' })
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Randomly label as success or failure
    if (Math.random() > 0.5) {
      trigger({ type: 'SUCCESS' })
    } else {
      trigger({ type: 'FAILURE' })
    }
  }

  // Check that data was collected
  const stats = collector.getStats()
  expect(stats.totalSamples).toBeGreaterThan(0)

  // Train if we have data
  if (stats.totalSamples > 0) {
    const { predictor, results } = await trainPredictor(collector, { epochs: 5 })
    expect(results.accuracy).toBeGreaterThanOrEqual(0)
    expect(results.loss).toBeGreaterThanOrEqual(0)
    predictor.dispose()
  }

  disconnect()
})

test('Behavioral predictor listener integrates with program', async () => {
  const { bThreads, trigger, useFeedback } = behavioral()

  // Create and train a simple predictor
  const predictor = new BPPredictor()
  const features = [[1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0]]
  const labels = [true]
  await predictor.train(features, labels, 5)

  // Create behavioral predictor listener
  const { listener, snapshotSignal, predictionSignal, disconnect } = createBehavioralPredictorListener(
    predictor,
    useFeedback,
    trigger,
    {
      threshold: 0.5,
      eventTypes: ['PREDICT_THIS'],
      onPrediction: (prob, matched) => {
        console.log(`Prediction: ${prob}, Matched: ${matched}`)
      },
    },
  )

  // Set up a thread that uses the ML listener
  bThreads.set({
    'ml-thread': bThread([bSync({ waitFor: listener }), bSync({ request: { type: 'ML_TRIGGERED' } })], true),
  })

  // Track ML triggers
  useFeedback({
    ML_TRIGGERED: () => {
      console.log('ML listener was triggered')
    },
  })

  // Send a test snapshot
  const testSnapshot: SnapshotMessage = [{ thread: 'test', trigger: false, selected: true, type: 'TEST', priority: 1 }]

  // Send snapshot via feedback (not in useSnapshot to avoid loops)
  setTimeout(() => {
    trigger({ type: 'BP_SNAPSHOT', detail: testSnapshot })
    trigger({ type: 'PREDICT_THIS' })
  }, 10)

  // Wait for processing
  await new Promise((resolve) => setTimeout(resolve, 100))

  // Check that signals were updated
  expect(snapshotSignal.get()).toBeTruthy()
  expect(predictionSignal.get()).toBeGreaterThanOrEqual(0)

  disconnect()
  predictor.dispose()
})

test('Feature extraction works correctly', () => {
  const collector = new SnapshotCollector()

  const snapshot: SnapshotMessage = [
    {
      thread: 'thread1',
      trigger: false,
      selected: true,
      type: 'EVENT_A',
      priority: 1,
      detail: { data: 'test' },
    },
    {
      thread: 'thread2',
      trigger: true,
      selected: false,
      type: 'EVENT_B',
      priority: 2,
      blockedBy: 'thread1',
    },
    {
      thread: 'thread3',
      trigger: false,
      selected: false,
      type: 'EVENT_C',
      priority: 3,
      interrupts: 'thread2',
    },
  ]

  const features = collector.extractFeatures(snapshot)

  expect(features.length).toBe(13)
  expect(features[0]).toBe(3) // Total bids
  expect(features[1]).toBe(1) // Selected bids
  expect(features[2]).toBe(1) // Blocked bids
  expect(features[3]).toBe(1) // Interrupting bids
  expect(features[4]).toBe(1) // Trigger bids
})

test('Dataset splitting works correctly', () => {
  const features = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    [10, 11, 12],
    [13, 14, 15],
  ]
  const labels = [true, false, true, false, true]

  const { trainFeatures, trainLabels, testFeatures, testLabels } = splitDataset(
    features,
    labels,
    0.4, // 40% test
  )

  expect(trainFeatures.length).toBe(3)
  expect(trainLabels.length).toBe(3)
  expect(testFeatures.length).toBe(2)
  expect(testLabels.length).toBe(2)

  // Check that all data is accounted for
  const allFeatures = [...trainFeatures, ...testFeatures]
  expect(allFeatures.length).toBe(features.length)
})

test('Signal-based snapshot collection', async () => {
  const { trigger, useFeedback } = behavioral()
  const collector = new SnapshotCollector()

  // Connect signals
  collector.snapshotSignal.listen('SNAPSHOT_UPDATE', trigger)

  // Track signal updates
  let signalUpdated = false
  useFeedback({
    SNAPSHOT_UPDATE: () => {
      signalUpdated = true
    },
  })

  // Add a snapshot
  const snapshot: SnapshotMessage = [{ thread: 'test', trigger: false, selected: true, type: 'TEST', priority: 1 }]
  collector.addSnapshot(snapshot)

  // Wait for signal propagation
  await new Promise((resolve) => setTimeout(resolve, 10))

  // Check signal was updated
  expect(signalUpdated).toBe(true)
  expect(collector.snapshotSignal.get()).toEqual(snapshot)
})
