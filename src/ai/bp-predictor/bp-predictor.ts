import * as tf from '@tensorflow/tfjs'
import type { SnapshotMessage } from '../../behavioral/behavioral.js'
import { SnapshotCollector } from './snapshot-collector.js'

/**
 * Configuration for model training
 */
type ActivationIdentifier =
  | 'elu'
  | 'hardSigmoid'
  | 'linear'
  | 'relu'
  | 'relu6'
  | 'selu'
  | 'sigmoid'
  | 'softmax'
  | 'softplus'
  | 'softsign'
  | 'tanh'
  | 'swish'
  | 'mish'
  | 'gelu'
  | 'gelu_new'

type InitializerIdentifier =
  | 'constant'
  | 'glorotNormal'
  | 'glorotUniform'
  | 'heNormal'
  | 'heUniform'
  | 'identity'
  | 'leCunNormal'
  | 'leCunUniform'
  | 'ones'
  | 'orthogonal'
  | 'randomNormal'
  | 'randomUniform'
  | 'truncatedNormal'
  | 'varianceScaling'
  | 'zeros'
  | string

export type BPTrainingConfig = {
  architecture?: {
    hiddenUnits?: number[] | 'auto' // Layer sizes or 'auto' for dynamic sizing
    dropoutRates?: number[] // Dropout rates for each layer
    activation?: ActivationIdentifier // Activation function for hidden layers
    outputActivation?: ActivationIdentifier // Activation for output layer
    kernelInitializer?: InitializerIdentifier // Weight initialization method
  }
  optimizer?: {
    type?: 'adam' | 'sgd' | 'rmsprop' // Optimizer type
    learningRate?: number // Learning rate
  }
  training?: {
    batchSize?: number // Batch size for training
    validationSplit?: number // Fraction of data for validation
    verbose?: 0 | 1 | 2 // Logging verbosity
    logFrequency?: number // Log every N epochs
  }
}

/**
 * Binary classifier for behavioral program state prediction.
 * Trains on snapshot data and provides synchronous predictions.
 */
export class BPPredictor {
   #model: tf.Sequential | null = null
   #collector = new SnapshotCollector()
   #featureScaler: { mean: number[]; std: number[] } | null = null

  /**
   * Train the model on collected snapshot data
   * @param features Feature vectors extracted from snapshots
   * @param labels Binary labels (true/false) for each snapshot
   * @param epochs Number of training epochs
   * @param config Optional training configuration
   */
  async train(
    features: number[][],
    labels: boolean[],
    epochs: number = 50,
    config?: BPTrainingConfig,
  ): Promise<{ accuracy: number; loss: number }> {
    if (features.length === 0) {
      throw new Error('No training data provided')
    }

    // Calculate feature scaling parameters
    this.#calculateScalingParams(features)

    // Scale features
    const scaledFeatures = this.#scaleFeatures(features)

    // Apply default configuration
    const architecture = config?.architecture ?? {}
    const optimizer = config?.optimizer ?? {}
    const training = config?.training ?? {}

    // Set architecture defaults
    const inputDim = features[0].length
    const hiddenUnits =
      architecture.hiddenUnits === 'auto' || !architecture.hiddenUnits
        ? [Math.ceil(inputDim * 1.5), Math.ceil(inputDim * 0.75)]
        : architecture.hiddenUnits
    const dropoutRates = architecture.dropoutRates ?? [0.2, 0.1]
    const activation = architecture.activation ?? 'relu'
    const outputActivation = architecture.outputActivation ?? 'sigmoid'
    const kernelInitializer = architecture.kernelInitializer ?? 'heNormal'

    // Set optimizer defaults
    const optimizerType = optimizer.type ?? 'adam'
    const learningRate = optimizer.learningRate ?? 0.001

    // Set training defaults
    const batchSize = training.batchSize ?? 32
    const validationSplit = training.validationSplit ?? 0.2
    const verbose = training.verbose ?? 0
    const logFrequency = training.logFrequency ?? 10

    // Create model if not exists
    if (!this.#model) {
      const layers: tf.layers.Layer[] = []

      // Build layers based on configuration
      for (let i = 0; i < hiddenUnits.length; i++) {
        layers.push(
          tf.layers.dense({
            inputShape: i === 0 ? [inputDim] : undefined,
            units: hiddenUnits[i],
            activation,
            kernelInitializer,
          }),
        )

        // Add dropout if specified
        if (i < dropoutRates.length && dropoutRates[i] > 0) {
          layers.push(tf.layers.dropout({ rate: dropoutRates[i] }))
        }
      }

      // Add output layer
      layers.push(
        tf.layers.dense({
          units: 1,
          activation: outputActivation,
        }),
      )

      this.#model = tf.sequential({ layers })

      // Create optimizer
      let tfOptimizer: tf.Optimizer
      switch (optimizerType) {
        case 'sgd':
          tfOptimizer = tf.train.sgd(learningRate)
          break
        case 'rmsprop':
          tfOptimizer = tf.train.rmsprop(learningRate)
          break
        case 'adam':
        default:
          tfOptimizer = tf.train.adam(learningRate)
      }

      this.#model.compile({
        optimizer: tfOptimizer,
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
    const history = await this.#model.fit(xs, ys, {
      epochs,
      batchSize,
      validationSplit,
      verbose,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % logFrequency === 0 && logs) {
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
    if (!this.#model) {
      throw new Error('Model not trained yet')
    }

    if (!this.#featureScaler) {
      throw new Error('Feature scaler not initialized')
    }

    // Extract and scale features
    const features = this.#collector.extractFeatures(snapshot)
    const scaledFeatures = this.#scaleFeatures([features])[0]

    // Create tensor
    const input = tf.tensor2d([scaledFeatures])

    // Predict
    const prediction = this.#model.predict(input) as tf.Tensor
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
    if (!this.#model) {
      throw new Error('Model not trained yet')
    }

    if (!this.#featureScaler) {
      throw new Error('Feature scaler not initialized')
    }

    // Extract and scale features
    const features = this.#collector.extractFeatures(snapshot)
    const scaledFeatures = this.#scaleFeatures([features])[0]

    // Create tensor
    const input = tf.tensor2d([scaledFeatures])

    // Predict
    const prediction = this.#model.predict(input) as tf.Tensor
    const value = prediction.dataSync()[0]

    // Cleanup
    input.dispose()
    prediction.dispose()

    return value
  }

  /**
   * Calculate mean and standard deviation for feature scaling
   */
  #calculateScalingParams(features: number[][]): void {
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

    this.#featureScaler = { mean, std }
  }

  /**
   * Scale features using z-score normalization
   */
  #scaleFeatures(features: number[][]): number[][] {
    if (!this.#featureScaler) {
      throw new Error('Feature scaler not initialized')
    }

    return features.map((feature) =>
      feature.map((val, i) => (val - this.#featureScaler!.mean[i]) / this.#featureScaler!.std[i]),
    )
  }

  /**
   * Save the model to a specified path
   */
  async save(path: string): Promise<void> {
    if (!this.#model) {
      throw new Error('Model not trained yet')
    }
    await this.#model.save(path)

    // Also save the scaler params
    if (this.#featureScaler) {
      const scalerPath = path.endsWith('/') ? path + 'scaler.json' : path + '/scaler.json'
      if (typeof window === 'undefined') {
        // Node.js environment
        const fs = await import('fs')
        fs.writeFileSync(scalerPath, JSON.stringify(this.#featureScaler))
      }
    }
  }

  /**
   * Load a pre-trained model from a specified path
   */
  async load(path: string): Promise<void> {
    this.#model = (await tf.loadLayersModel(path)) as tf.Sequential

    // Also load the scaler params
    const scalerPath = path.endsWith('/') ? path + 'scaler.json' : path + '/scaler.json'
    if (typeof window === 'undefined') {
      // Node.js environment
      const fs = await import('fs')
      const scalerData = fs.readFileSync(scalerPath, 'utf-8')
      this.#featureScaler = JSON.parse(scalerData)
    }
  }

  /**
   * Dispose of the model and free memory
   */
  dispose(): void {
    if (this.#model) {
      this.#model.dispose()
      this.#model = null
    }
    this.#featureScaler = null
  }
}