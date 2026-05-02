/**
 * @d1dx/paperclip-gchat-adapter
 *
 * Paperclip plugin entry point. Loaded by Paperclip's plugin store
 * (`adapter-plugins/node_modules/@d1dx/paperclip-gchat-adapter`).
 *
 * Plugin contract (verified against Paperclip upstream commit
 * 685ee84e4a9c33d37d3c9900cc810c3a9d2f373c):
 *
 *   - Module exports a `createServerAdapter()` function
 *   - Returned object has `{ type, execute, testEnvironment, models?, agentConfigurationDoc? }`
 *   - Adapter type string is namespace-free (`"gchat"`)
 *   - Loaded from `adapter-plugins/node_modules/<pkg>` after npm install
 *   - Hot-reloadable via Paperclip's `reloadExternalAdapter("gchat")`
 *
 * v0.1 stub — `execute()` is intentionally not yet implemented. See task
 * `tasks/NO-ID (paperclip-gchat-bridge)/README.md` Phase 4 for the schedule.
 */

export const ADAPTER_TYPE = "gchat" as const;

export const agentConfigurationDoc = `# gchat agent configuration

Adapter: gchat — Google Chat human agent.

Required \`adapterConfig\` fields:

- \`gchatUserId\` (string): Google Chat user resource name (e.g. \`users/12345...\`).
- \`responderUrl\` (string): Public URL of the companion responder service that will receive Chat reply events for this agent.

Optional fields:

- \`language\` (string, default \`"en"\`): ISO language code for DM formatting.
- \`timezone\` (string, IANA): used for "X minutes ago" rendering.

Required Paperclip env (read by this adapter):

- \`GCHAT_SERVICE_ACCOUNT_JSON\` — service account credentials, single-line JSON.
- \`GCHAT_BOT_NAME\` — display name for the bot (default \`"Paperclip"\`).

When an issue is assigned to a \`gchat\`-typed agent, this adapter sends a DM
to \`gchatUserId\` with the issue context and a slash-command grammar reference.
The human's reply is captured by the companion responder service, which posts
back to Paperclip REST authenticated as the agent.

See https://github.com/D1DX/paperclip-gchat-bridge for full architecture.
`;

/**
 * Plugin contract entry point. Paperclip's plugin loader calls this on load
 * and on hot-reload. Returns the adapter module shape Paperclip expects.
 *
 * v0.1 stub — `execute` returns a "not implemented" error so a misconfigured
 * production install fails loud rather than silently dropping DMs.
 */
export function createServerAdapter() {
  return {
    type: ADAPTER_TYPE,

    async execute(_ctx: unknown) {
      throw new Error(
        "[paperclip-gchat-adapter v0.1.0-pre] execute() is not implemented yet. " +
          "Track Phase 4 in https://github.com/D1DX/paperclip-gchat-bridge",
      );
    },

    async testEnvironment(_ctx: unknown) {
      return {
        ok: false,
        message:
          "testEnvironment() not implemented yet (v0.1.0-pre scaffold). See Phase 4.",
      };
    },

    models: [],
    agentConfigurationDoc,
  };
}
