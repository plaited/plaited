import * as tf from '@tensorflow/tfjs'
import type { SnapshotMessage } from '../behavioral/behavioral.js'
import { SnapshotCollector } from './snapshot-collector.js'

/**
 * Binary classifier for behavioral program state prediction.
 * Trains on snapshot data and provides synchronous predictions.
 */
export class BPPredictor {
  private model: tf.Sequential | null = null
  private collector = new SnapshotCollector()
  private featureScaler: { mean: number[]; std: number[] } | null = null

  /**
   * Train the model on collected snapshot data
   * @param features Feature vectors extracted from snapshots
   * @param labels Binary labels (true/false) for each snapshot
   * @param epochs Number of training epochs
   */
  async train(
    features: number[][],
    labels: boolean[],
    epochs: number = 50,
  ): Promise<{ accuracy: number; loss: number }> {
    if (features.length === 0) {
      throw new Error('No training data provided')
    }

    // Calculate feature scaling parameters
    this.calculateScalingParams(features)

    // Scale features
    const scaledFeatures = this.scaleFeatures(features)

    // Create model if not exists
    if (!this.model) {
      const inputDim = features[0].length
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({
            inputShape: [inputDim],
            units: Math.ceil(inputDim * 1.5),
            activation: 'relu',
            kernelInitializer: 'heNormal',
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: Math.ceil(inputDim * 0.75),
            activation: 'relu',
            kernelInitializer: 'heNormal',
          }),
          tf.layers.dropout({ rate: 0.1 }),
          tf.layers.dense({
            units: 1,
            activation: 'sigmoid',
          }),
        ],
      })

      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
      })
    }

    // Convert to tensors
    const xs = tf.tensor2d(scaledFeatures)
    const ys = tf.tensor2d(
      labels.map((l) => (l ? 1 : 0)),
      [labels.length, 1],
    )

    // Train
    const history = await this.model.fit(xs, ys, {
      epochs,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 0,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0 && logs) {
            console.log(`Epoch ${epoch}: loss=${logs.loss?.toFixed(4)}, accuracy=${logs.acc?.toFixed(4)}`)
          }
        },
      },
    })

    // Get final metrics
    const finalLoss = (history.history.loss?.[history.history.loss.length - 1] as number) ?? 0
    const finalAccuracy = (history.history.acc?.[history.history.acc.length - 1] as number) ?? 0

    // Cleanup
    xs.dispose()
    ys.dispose()

    return {
      accuracy: finalAccuracy,
      loss: finalLoss,
    }
  }

  /**
   * Make a synchronous prediction for a given snapshot
   * @param snapshot The current state snapshot
   * @returns Boolean prediction
   */
  predict(snapshot: SnapshotMessage): boolean {
    if (!this.model) {
      throw new Error('Model not trained yet')
    }

    if (!this.featureScaler) {
      throw new Error('Feature scaler not initialized')
    }

    // Extract and scale features
    const features = this.collector.extractFeatures(snapshot)
    const scaledFeatures = this.scaleFeatures([features])[0]

    // Create tensor
    const input = tf.tensor2d([scaledFeatures])

    // Predict
    const prediction = this.model.predict(input) as tf.Tensor
    const value = prediction.dataSync()[0]

    // Cleanup
    input.dispose()
    prediction.dispose()

    // Return binary prediction
    return value > 0.5
  }

  /**
   * Get probability score for a snapshot
   * @param snapshot The current state snapshot
   * @returns Probability score between 0 and 1
   */
  predictProbability(snapshot: SnapshotMessage): number {
    if (!this.model) {
      throw new Error('Model not trained yet')
    }

    if (!this.featureScaler) {
      throw new Error('Feature scaler not initialized')
    }

    // Extract and scale features
    const features = this.collector.extractFeatures(snapshot)
    const scaledFeatures = this.scaleFeatures([features])[0]

    // Create tensor
    const input = tf.tensor2d([scaledFeatures])

    // Predict
    const prediction = this.model.predict(input) as tf.Tensor
    const value = prediction.dataSync()[0]

    // Cleanup
    input.dispose()
    prediction.dispose()

    return value
  }

  /**
   * Calculate mean and standard deviation for feature scaling
   */
  private calculateScalingParams(features: number[][]): void {
    const numFeatures = features[0].length
    const mean = new Array(numFeatures).fill(0)
    const std = new Array(numFeatures).fill(0)

    // Calculate mean
    for (const feature of features) {
      for (let i = 0; i < numFeatures; i++) {
        mean[i] += feature[i]
      }
    }
    for (let i = 0; i < numFeatures; i++) {
      mean[i] /= features.length
    }

    // Calculate standard deviation
    for (const feature of features) {
      for (let i = 0; i < numFeatures; i++) {
        std[i] += Math.pow(feature[i] - mean[i], 2)
      }
    }
    for (let i = 0; i < numFeatures; i++) {
      std[i] = Math.sqrt(std[i] / features.length)
      // Prevent division by zero
      if (std[i] === 0) std[i] = 1
    }

    this.featureScaler = { mean, std }
  }

  /**
   * Scale features using z-score normalization
   */
  private scaleFeatures(features: number[][]): number[][] {
    if (!this.featureScaler) {
      throw new Error('Feature scaler not initialized')
    }

    return features.map((feature) =>
      feature.map((val, i) => (val - this.featureScaler!.mean[i]) / this.featureScaler!.std[i]),
    )
  }

  /**
   * Save the model to a specified path
   */
  async save(path: string): Promise<void> {
    if (!this.model) {
      throw new Error('Model not trained yet')
    }
    await this.model.save(path)

    // Also save the scaler params
    if (this.featureScaler) {
      const scalerPath = path.endsWith('/') ? path + 'scaler.json' : path + '/scaler.json'
      if (typeof window === 'undefined') {
        // Node.js environment
        const fs = await import('fs')
        fs.writeFileSync(scalerPath, JSON.stringify(this.featureScaler))
      }
    }
  }

  /**
   * Load a pre-trained model from a specified path
   */
  async load(path: string): Promise<void> {
    this.model = (await tf.loadLayersModel(path)) as tf.Sequential

    // Also load the scaler params
    const scalerPath = path.endsWith('/') ? path + 'scaler.json' : path + '/scaler.json'
    if (typeof window === 'undefined') {
      // Node.js environment
      const fs = await import('fs')
      const scalerData = fs.readFileSync(scalerPath, 'utf-8')
      this.featureScaler = JSON.parse(scalerData)
    }
  }

  /**
   * Dispose of the model and free memory
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose()
      this.model = null
    }
    this.featureScaler = null
  }
}
