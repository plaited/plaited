import { BPPredictor, type BPTrainingConfig } from '../bp-predictor.js'

// Example: Using default configuration
const predictor1 = new BPPredictor()
// await predictor1.train(features, labels, 100)

// Example: Custom architecture with deeper network
const deepConfig: BPTrainingConfig = {
  architecture: {
    hiddenUnits: [128, 64, 32, 16], // 4 hidden layers
    dropoutRates: [0.3, 0.25, 0.2, 0.1], // Progressive dropout
    activation: 'relu',
    outputActivation: 'sigmoid',
    kernelInitializer: 'heNormal',
  },
  optimizer: {
    type: 'adam',
    learningRate: 0.0005, // Lower learning rate for stability
  },
  training: {
    batchSize: 64, // Larger batch size
    validationSplit: 0.3, // 30% validation
    verbose: 1, // Show progress
    logFrequency: 5, // Log every 5 epochs
  },
}

const predictor2 = new BPPredictor()
// await predictor2.train(features, labels, 200, deepConfig)

// Example: Simple configuration for small datasets
const simpleConfig: BPTrainingConfig = {
  architecture: {
    hiddenUnits: 'auto', // Automatic sizing based on input
    dropoutRates: [0.1], // Minimal dropout
    activation: 'tanh', // Different activation
  },
  optimizer: {
    type: 'sgd',
    learningRate: 0.01,
  },
  training: {
    batchSize: 16,
    validationSplit: 0.1,
  },
}

const predictor3 = new BPPredictor()
// await predictor3.train(features, labels, 50, simpleConfig)

// Example: Configuration for preventing overfitting
const regularizedConfig: BPTrainingConfig = {
  architecture: {
    hiddenUnits: [32, 16], // Smaller network
    dropoutRates: [0.5, 0.4], // High dropout
    activation: 'elu',
  },
  optimizer: {
    type: 'rmsprop',
    learningRate: 0.001,
  },
  training: {
    batchSize: 8, // Small batches for more updates
    validationSplit: 0.25,
    verbose: 2, // Maximum verbosity
    logFrequency: 1, // Log every epoch
  },
}

const predictor4 = new BPPredictor()
// await predictor4.train(features, labels, 100, regularizedConfig)