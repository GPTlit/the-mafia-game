import { createFileRoute } from "@tanstack/react-router";

// Narrator voice: George (deep, calm storyteller). Multilingual model covers Arabic, English, French.
const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

export const Route = createFileRoute("/api/narrate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.ELEVENLABS_API_KEY;
        if (!key) return new Response("Narrator voice not connected", { status: 503 });
        let text = "";
        try {
          const body = (await request.json()) as { text?: unknown };
          text = typeof body.text === "string" ? body.text.slice(0, 400) : "";
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        if (!text.trim()) return new Response("Missing text", { status: 400 });

        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: { "xi-api-key": key, "Content-Type": "application/json" },
            body: JSON.stringify({
              text,
              model_id: "eleven_multilingual_v2",
              voice_settings: { stability: 0.6, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true },
            }),
          },
        );
        if (!res.ok) {
          const err = await res.text();
          console.error(`ElevenLabs failed [${res.status}]: ${err}`);
          return new Response(`Narrator failed [${res.status}]: ${err}`, { status: 502 });
        }
        return new Response(res.body, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" },
        });
      },
    },
  },
});
