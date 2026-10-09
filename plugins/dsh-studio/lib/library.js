// @muen/dsh-studio — the recipe library (M10).
//
// A recipe is a generation remembered exactly: what was sent (prompt, params,
// Look, refs) plus the person's stars and tags. Local-first in
// <root>/library/library.json — one file until it grows (M11 syncs it to the
// person's own GitHub). Ratings are 0–5; Recall answers a recipe whole so the
// desk can prefill a payload that MATCHES what produced a known-good take.

import { promises as fs } from 'node:fs'
import path from 'node:path'

export const LIBRARY_SCHEMA = 1

export function validRating(rating) {
  const n = Number(rating)
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : null
}

/** A take becomes a recipe. Everything known about the spend goes in. */
export function recipeFromTake(shot, take, { look = null, refs = [], workflow = null, seed = null } = {}) {
  return {
    id: 'r-' + String(take.job),
    kind: 'video',
    provider: take.provider,
    jobId: String(take.job),
    recipe: {
      prompt: String((shot && shot.prompt) || ''),
      seed,
      params: { duration_s: (shot && shot.duration_s) || null, workflow },
      look,
      refs: Array.isArray(refs) ? refs : [],
    },
    rating: 0,
    tags: [],
    created: new Date().toISOString(),
  }
}

export function createLibrary(root) {
  const file = path.join(root, 'library.json')

  async function readAll() {
    try {
      const doc = JSON.parse(await fs.readFile(file, 'utf8'))
      return doc && Array.isArray(doc.recipes) ? doc.recipes : []
    } catch {
      return []
    }
  }

  async function writeAll(recipes) {
    await fs.mkdir(root, { recursive: true })
    const tmp = file + '.tmp'
    await fs.writeFile(tmp, JSON.stringify({ schema: LIBRARY_SCHEMA, recipes }, null, 2) + '\n', 'utf8')
    await fs.rename(tmp, file)
  }

  /** Browse: kind, minimum rating, tag — the three filters the design names. */
  async function list({ kind, minRating, tag } = {}) {
    const recipes = await readAll()
    return {
      ok: true,
      recipes: recipes.filter((recipe) => {
        if (kind && recipe.kind !== kind) return false
        if (minRating !== undefined && minRating !== null && recipe.rating < Number(minRating)) return false
        if (tag && !(recipe.tags || []).includes(tag)) return false
        return true
      }),
    }
  }

  /** Upsert a whole recipe (the star control posts the take's recipe). */
  async function upsert(recipe) {
    if (!recipe || typeof recipe !== 'object' || typeof recipe.id !== 'string' || recipe.id === '') {
      return { ok: false, code: 400, error: 'bad recipe' }
    }
    const rating = validRating(recipe.rating === undefined ? 0 : recipe.rating)
    if (rating === null) return { ok: false, code: 400, error: 'rating must be 0–5' }
    if (!recipe.recipe || typeof recipe.recipe.prompt !== 'string') {
      return { ok: false, code: 400, error: 'recipe needs a prompt' }
    }
    const recipes = await readAll()
    const next = { ...recipe, rating, tags: Array.isArray(recipe.tags) ? recipe.tags : [] }
    const at = recipes.findIndex((entry) => entry.id === recipe.id)
    if (at >= 0) recipes[at] = next
    else recipes.push(next)
    await writeAll(recipes)
    return { ok: true, recipe: next }
  }

  /** Star it. One field changes; everything else stays as recorded. */
  async function rate(id, rating) {
    const stars = validRating(rating)
    if (stars === null) return { ok: false, code: 400, error: 'rating must be 0–5' }
    const recipes = await readAll()
    const at = recipes.findIndex((entry) => entry.id === id)
    if (at < 0) return { ok: false, code: 404, error: 'no recipe' }
    recipes[at] = { ...recipes[at], rating: stars }
    await writeAll(recipes)
    return { ok: true, recipe: recipes[at] }
  }

  async function get(id) {
    const recipes = await readAll()
    const recipe = recipes.find((entry) => entry.id === id)
    return recipe ? { ok: true, recipe } : { ok: false, code: 404, error: 'no recipe' }
  }

  return { root, file, list, upsert, rate, get, readAll }
}
