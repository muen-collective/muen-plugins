// @muen/dsh-studio — the BYOK chat seam (M2).
//
// The harness exposes a provider-neutral LLM service at `ctx.get('llm')`; the
// same seam dsh-recall's auto-propose already rides. There is no second
// credential store and no per-plugin OpenAI client: the seam resolves the key,
// this module only shapes the call. A profile with no llm service gets a plain
// `no-llm` answer the pane draws, never a thrown mount.

/** One chat completion through the harness seam. Returns `{ ok, text }` or `{ ok: false, code, error }`. */
export async function complete(ctx, { system, user, model, maxTokens = 1024 } = {}) {
  const llm = typeof ctx.get === 'function' ? ctx.get('llm') : undefined
  if (!llm || typeof llm.stream !== 'function') return { ok: false, code: 501, error: 'no-llm' }
  if (typeof user !== 'string' || user.trim() === '') return { ok: false, code: 400, error: 'no-user' }

  const messages = []
  if (typeof system === 'string' && system.trim() !== '') {
    messages.push({ role: 'system', content: [{ type: 'text', text: system }] })
  }
  messages.push({ role: 'user', content: [{ type: 'text', text: user }] })

  try {
    const chunks = llm.stream({
      messages,
      maxTokens,
      ...(model ? { model } : {}),
    })
    let text = ''
    for await (const chunk of chunks) {
      if (chunk.type === 'text') text += chunk.text
      if (chunk.type === 'finish') break
    }
    return { ok: true, text }
  } catch (error) {
    return { ok: false, code: 502, error: String((error && error.message) || error) }
  }
}
