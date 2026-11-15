/**
 * Reconstructed from docs/playtests/2026-11-14-combat-smoke-hosted.md finding 3 (calls 2184-2189).
 * See specs/116-react-confirm-params/spec.md "Replay fixtures (reconstructed)": the invented keys are
 * exact; values, target and wording are invented. Replace verbatim when the real bodies are recovered.
 */
export const RECONSTRUCTED_F1 = JSON.parse(
  `{"outcome":"confirm","triggers":[],"speaker":null,"text":"","encounterId":null,"companionPrompts":[],"confirm":[{"characterId":"tamsin","text":"Tamsin wades out onto the causeway.","body":{"kind":"move","targets":[{"kind":"zone","id":"causeway"}],"params":{"skill":"athletics"}}}],"answer":null,"reason":"Tamsin declared a move; offer it for confirmation."}`,
);
export const RECONSTRUCTED_F1_RETRY = JSON.parse(
  `{"outcome":"confirm","triggers":[],"speaker":null,"text":"","encounterId":null,"companionPrompts":[],"confirm":[{"characterId":"tamsin","text":"Tamsin wades out onto the causeway.","body":{"kind":"move","targets":[{"kind":"zone","id":"causeway"}],"params":{}}}],"answer":null,"reason":"Tamsin declared a move; offer it for confirmation."}`,
);
export const RECONSTRUCTED_F2 = JSON.parse(
  `{"outcome":"confirm","triggers":[],"speaker":null,"text":"","encounterId":null,"companionPrompts":[],"confirm":[{"characterId":"tamsin","text":"Tamsin edges along the causeway, ready for trouble.","body":{"kind":"move","targets":[{"kind":"zone","id":"causeway"}],"params":{"ready":true,"caution":"high"}}}],"answer":null,"reason":"Tamsin declared a careful move; offer it for confirmation."}`,
);
export const RECONSTRUCTED_F2_RETRY = JSON.parse(
  `{"outcome":"confirm","triggers":[],"speaker":null,"text":"","encounterId":null,"companionPrompts":[],"confirm":[{"characterId":"tamsin","text":"Tamsin edges along the causeway, ready for trouble.","body":{"kind":"move","targets":[{"kind":"zone","id":"causeway"}],"params":{}}}],"answer":null,"reason":"Tamsin declared a careful move; offer it for confirmation."}`,
);
