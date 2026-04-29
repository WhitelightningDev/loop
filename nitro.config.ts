import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  // Ensure Vercel builds the correct Build Output API shape even if auto-detection fails.
  preset: "vercel",
});

