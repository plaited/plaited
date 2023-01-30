import { serve } from "https://deno.land/std@0.175.0/http/server.ts";
serve((_req) => new Response("Hello, world"), {
  onListen({ port, hostname }) {
    console.log(`Server started at http://${hostname}:${port}`);
    // ... more info specific to your server ..
  },
});
console.log(Deno.networkInterfaces());