# Probe (Phase 3), 2026-10-29

Every command ran under the operator's go on that exact command, recorded on TASK-0181.

## Attempts

1. **P1 with curl.** `curl` does not exist in `stacks-dev-app-1` (`sh: curl: not found`). No model call was made.
2. **P1 with Node `fetch`, hard-coded URL.** `getaddrinfo ENOTFOUND 9router.local.infinity-node.win`. No model call was made.
3. **P1 with Node `fetch`, using the app's own `dm.interpret` route** from `AI_PROVIDERS`/`AI_PURPOSES`:
   - The route: provider `claude`, kind `openai-compatible`, baseUrl `http://9router.local.infinity-node.win/v1`, model `cc/claude-sonnet-5`, maxTokens `1200`.
   - Result: `ENOTFOUND` again. No model call was made.

P2 was not run.

## DNS checks (read-only)

- The container `/etc/resolv.conf` uses Docker's resolver `127.0.0.11`, which forwards to the host's `127.0.0.53` (systemd-resolved), with `search local.infinity-node.win`. `/etc/hosts` has no 9router entry.
- `getent hosts 9router.local.infinity-node.win` returned nothing on vm-104 itself and nothing in the container. The combined command exited 2.

## Finding

On 2026-10-29, vm-104 cannot resolve the 9router hostname: not on the host, and not in the app container. The app's configured AI route is unreachable from hosted dev, so every DM model call there fails before it reaches 9router. This is separate from the think-block cause (AC #1), which stays unconfirmed by a probe. Run 2 of the alpha (2026-10-28) reached 9router, so the name stopped resolving after run 2.

## Tailnet URL (operator-run, 2026-10-29)

The operator suggested `https://9router.tailb3c1b6.ts.net/`. From the orchestrator's Mac, `/v1/models` resolves to `100.81.194.62` and answers HTTP 401 without a key, so 9router is up on the tailnet.

The operator ran P1 and P2 personally, with the override `https://9router.tailb3c1b6.ts.net/v1`. Both failed in `stacks-dev-app-1` with `getaddrinfo ENOTFOUND 9router.tailb3c1b6.ts.net`. No model call was made.

Neither hostname resolves from the vm-104 app container on 2026-10-29: the LAN name and the tailnet name both fail.

## vm-104 resolver (operator-run, 2026-10-29)

`resolvectl status` on vm-104:
- Link `ens18` lists the DNS servers `192.168.1.79 2605:9fc0:0:53::1 2605:9fc0:0:53::2`, with DNS domain `local.infinity-node.win`.
- The current DNS server is `2605:9fc0:0:53::1`.
- `resolvectl query 9router.local.infinity-node.win` answers "not found".

Reading: systemd-resolved moved off the LAN server `192.168.1.79` to an upstream IPv6 server, which does not know `local.infinity-node.win`. That server's NXDOMAIN is final, so resolved never falls back. The operator resolves the name from other machines. The fault is vm-104's resolver choice, not 9router. The fix is the operator's infrastructure call, for example limiting `ens18` to `192.168.1.79` in netplan, or stopping the router from advertising the IPv6 DNS servers.

The operator confirmed on 2026-10-29: 9router is defined in the Pi-hole at `192.168.1.79` and resolves to `192.168.1.103`. vm-104 is querying an upstream IPv6 server, so it never asks the Pi-hole.

## P1 by IP (operator-run, 2026-10-29)

The operator ran `probe-ip.mjs p1` in `stacks-dev-app-1`. It sends to `http://192.168.1.103/v1/chat/completions` with `Host: 9router.local.infinity-node.win`, model `cc/claude-sonnet-5` and `max_tokens` 1200.

- The response was status 200 with no server or version header. The stream reported model `claude-sonnet-5`.
- `delta.content` carried `{"ok":true}`, with no `<think>` block in any delta field.
- `finish_reason` was `stop`. Usage: `prompt_tokens` 2048, `completion_tokens` 9.

Reading:
- A trivial prompt does not reproduce the think block. That fits thinking that the model or router turns on adaptively for harder prompts. It does not fit thinking that is always on, so the R1 claim "thinking is always on" is weakened.
- `prompt_tokens` 2048 for a one-line message means the router adds about 2,000 tokens of its own system prompt on `cc/` routes.
- The `stripThink` fix holds whatever the trigger. To confirm the cause, replay a real `dm.interpret` prompt, which needs a captured request body.
