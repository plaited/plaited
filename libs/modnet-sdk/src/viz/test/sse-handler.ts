import { wait } from '@plaited/utils'
import { games, generate, runs } from './generate-game.js'
import { generateDot } from '../generate-dot.js'
import { dotToSVG } from '../dot-to-svg.js'
import { formatSVG } from '../format-svg.js'

const sendSSEMessage = async (controller: ReadableStreamDefaultController) => {
  await wait(1000)
  for (const game of games) generate(game)
  const dot = generateDot(runs)
  const svg = await dotToSVG(dot)
  const detail = formatSVG(svg!)
  controller.enqueue(`data: ${JSON.stringify({ type:'renderSVG',  detail})}\n\n`);
}

export const sse = (req: Request) =>{
  const { signal } = req;
  return new Response(
    new ReadableStream({
      start(controller) {
        void sendSSEMessage(controller);
        signal.onabort = () => {
          controller.close();
        };
      }
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      }
    }
  )
}