import { IAssertionMessage, IReportParam, MapFunc } from '../types.ts'
import { pixelmatch } from './deps.ts'

export const map = (mapFn: MapFunc) =>
  async function* (stream: IReportParam) {
    for await (const element of stream) {
      yield mapFn(element)
    }
  }

export const passThroughReporter = map((message) => message)

// createDiffReporter()(streamRunFromSocket(socket))

export async function* streamRunFromSocket(socket: WebSocket) {
  const buffer: IAssertionMessage[] = []
  let done = false
  let release: (val?: unknown) => void
  try {
    socket.addEventListener('message', listener)

    while (true) {
      if (done) {
        break
      }
      const message = buffer.shift()
      if (message) {
        yield message
      } else {
        await new Promise((resolve) => (release = resolve))
      }
    }
  } finally {
    socket.removeEventListener('message', listener)
  }
  function listener(
    evt: MessageEvent<string>,
  ) {
    const messageObj = JSON.parse(evt.data) as IAssertionMessage | {
      type: 'RUN_END'
    }

    if (messageObj.type === 'RUN_END') {
      console.log('end')
      done = true
    }

    buffer.push(messageObj as IAssertionMessage)
    release?.()
  }
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(`Error loading image: ${src}`)
    img.src = src
  })

export const compareImages = async (image1: string, image2: string, options?: {
  maxDiffPixelRatio?: number
  maxDiffPixels?: number
  threshold?: number
  includeAA?: boolean
  alpha?: number
  aaColor?: [number, number, number]
  diffColor?: [number, number, number]
}): Promise<boolean> => {
  // Load the images
  const img1 = await loadImage(image1)
  const img2 = await loadImage(image2)

  // Check if the images have the same dimensions
  if (img1.width !== img2.width || img1.height !== img2.height) {
    console.log('Error: Images have different dimensions')
    return false
  }

  // Create a canvas to draw the images onto
  const canvas = document.createElement('canvas')
  canvas.width = img1.width
  canvas.height = img1.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    console.error(' Canvas context missing')
    return false
  }

  // Draw the images onto the canvas
  ctx.drawImage(img1, 0, 0)
  ctx.drawImage(img2, 0, 0)

  // Compare the images using pixelmatch
  const { width, height } = img1
  const pixelRatio = window.devicePixelRatio || 1
  const {
    maxDiffPixelRatio = 0.1,
    maxDiffPixels = 100,
    threshold = 0.1,
    includeAA = true,
    alpha = 0.1,
    aaColor = [255, 255, 0],
    diffColor = [255, 0, 0],
  } = options || {}
  const diff = pixelmatch(
    ctx.getImageData(0, 0, width * pixelRatio, height * pixelRatio).data,
    ctx.getImageData(0, 0, width * pixelRatio, height * pixelRatio).data,
    null,
    width * pixelRatio,
    height * pixelRatio,
    { threshold, includeAA, alpha, aaColor, diffColor },
  )

  // Calculate the maximum number of different pixels allowed
  const maxDiff = Math.max(maxDiffPixelRatio * width * height, maxDiffPixels)

  // Check if the images are similar enough
  if (diff > maxDiff) {
    console.log(`Images are different: ${diff} different pixels`)
    return false
  }

  console.log('Images are the same')
  return true
}

// async function testAccessibilityWithAxe(
//   node: axe.ElementContext,
//   options: axe.RunOptions = {},
// ): Promise<boolean> {
//   // Run accessibility tests on the selected node using axe-core
//   const results: axe.AxeResults = await axe.run(node, options)

//   // Check if any violations were found
//   if (results.violations.length > 0) {
//     console.log(`Accessibility violations found for the selected node:`)
//     console.log(
//       results.violations.map((violation) => `- ${violation.help}`).join('\n'),
//     )
//     return false
//   }

//   console.log('Accessibility test passed for the selected node')
//   return true
// }
