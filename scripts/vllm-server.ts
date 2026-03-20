/**
 * vLLM server launcher for Plaited native-model inference.
 *
 * @remarks
 * Starts a vLLM inference server for local LLM serving.
 * Used in Phase 2+ to run fine-tuned Falcon 7B as the generation adapter.
 *
 * Environment variables:
 * - VLLM_MODEL_PATH: Path to model checkpoint (e.g., ./models/falcon-7b-native-model.qlora)
 * - VLLM_PORT: Server port (default: 8000)
 * - VLLM_GPU_MEMORY_UTILIZATION: GPU memory fraction (default: 0.9)
 * - VLLM_TENSOR_PARALLEL_SIZE: Tensor parallel size (default: 1)
 */

import { spawn } from 'node:child_process'

const MODEL_PATH = process.env.VLLM_MODEL_PATH || './models/falcon-7b-native-model'
const PORT = process.env.VLLM_PORT || '8000'
const GPU_MEMORY = process.env.VLLM_GPU_MEMORY_UTILIZATION || '0.9'
const TENSOR_PARALLEL = process.env.VLLM_TENSOR_PARALLEL_SIZE || '1'

console.log(`Starting vLLM server...`)
console.log(`  Model: ${MODEL_PATH}`)
console.log(`  Port: ${PORT}`)
console.log(`  GPU Memory: ${GPU_MEMORY}`)
console.log(`  Tensor Parallel: ${TENSOR_PARALLEL}`)

const server = spawn('python', [
  '-m',
  'vllm.entrypoints.openai.api_server',
  '--model',
  MODEL_PATH,
  '--port',
  PORT,
  '--gpu-memory-utilization',
  GPU_MEMORY,
  '--tensor-parallel-size',
  TENSOR_PARALLEL,
  '--trust-remote-code',
])

server.stdout?.on('data', (data) => {
  console.log(`[vLLM] ${data}`)
})

server.stderr?.on('data', (data) => {
  console.error(`[vLLM] ${data}`)
})

server.on('close', (code) => {
  console.log(`vLLM server exited with code ${code}`)
  process.exit(code ?? 1)
})

process.on('SIGINT', () => {
  console.log(`Stopping vLLM server...`)
  server.kill()
  process.exit(0)
})
