/**
 * verify:skill — Epic 61 S3's other half, and the design half that followed it.
 *
 *   "the skill asks for the link before it fetches anything, and writes nothing
 *    until the user confirms the endpoint list" — epic 61 §14, verbatim.
 *
 * Two skills ship in this package and they are a sequence: `add-rh-workflow` produces
 * the adapter, `design-generate-screen` decides what the surface shows once the adapter
 * exists. Each is prose, so the claims that can be checked mechanically are: that both
 * are registered, that the text the host serves is the text in this repo, that each
 * document's ordering holds where its own claim depends on order (asking before
 * fetching, confirming before writing; rules before steps), and that the plugin has no
 * write path of its own — which is what makes "writes nothing until the user confirms"
 * structural rather than a promise. The agent writes the adapter with its own file tool;
 * nothing in this plugin does.
 *
 * The model-facing half of the claim ("a mechanical install needs no model at all",
 * §2b) is held two ways: neither tool calls an LLM, and the host half imports no
 * LLM package — S4's pane path uses the same two tools.
 *
 *   node verify/skill.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const SKILL_FILE = join(ROOT, 'skills/add-rh-workflow/SKILL.md')
const DESIGN_FILE = join(ROOT, 'skills/design-generate-screen/SKILL.md')

const { apply } = await import(pathToFileURL(join(ROOT, 'lib/index.js')).href)
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const source = readFileSync(join(ROOT, 'lib/index.js'), 'utf8')

// ── reporter (the same shape as the other verify scripts) ─────────────────────

const rows = []
const check = (label, ok, detail) =>
  rows.push({ label, status: ok ? 'pass' : 'fail', detail: detail == null ? '' : String(detail) })

function finish() {
  let failed = 0
  process.stdout.write('\nverify:skill — Epic 61 S3 (add-rh-workflow) and the design skill\n')
  for (const row of rows) {
    if (row.status === 'pass') continue
    if (row.status === 'fail') failed += 1
    process.stdout.write('  FAIL  ' + row.label + (row.detail ? '  —  ' + row.detail : '') + '\n')
  }
  const passes = rows.filter((row) => row.status === 'pass').length
  process.stdout.write('  ' + passes + '/' + rows.length + ' passed\n')
  if (failed > 0) process.exitCode = 1
}

// ── mount ────────────────────────────────────────────────────────────────────

/** A recording context: what the plugin registers, and nothing else. */
function mount({ withTools = true, withSkills = true } = {}) {
  const registered = { tools: [], skills: [] }
  const services = {}
  if (withTools) {
    services.tools = {
      register: (definition) => {
        registered.tools.push(definition)
        return () => {}
      },
    }
  }
  if (withSkills) {
    services.skills = {
      register: (skill) => {
        registered.skills.push(skill)
        return () => {}
      },
    }
  }
  const ctx = {
    get: (name) => services[name],
    effect: (fn) => {
      fn()
    },
    inject: () => {},
    logger: { warn() {}, error() {} },
  }
  apply(ctx, { base: 'https://runninghub.test' })
  return registered
}

const registered = mount()
const skill = registered.skills.find((entry) => entry.name === 'add-rh-workflow')
const design = registered.skills.find((entry) => entry.name === 'design-generate-screen')
const shipped = readFileSync(SKILL_FILE, 'utf8')
const designShipped = readFileSync(DESIGN_FILE, 'utf8')
const at = (needle) => shipped.indexOf(needle)
const designAt = (needle) => designShipped.indexOf(needle)

// ── the registration ─────────────────────────────────────────────────────────

check('the skill is registered under the name the epic fixes', skill !== undefined && skill.name === 'add-rh-workflow', skill && skill.name)
check('it is both model-invocable and user-invocable', skill.invocation.modelInvocable === true && skill.invocation.userInvocable === true)
check('it is a runtime skill from this plugin', skill.source === 'runtime' && skill.provider === 'runninghub', skill.source + '/' + skill.provider)
check('the design skill is registered beside it', design !== undefined && design.name === 'design-generate-screen', design && design.name)
check('exactly the two shipped skills are registered, and no more', registered.skills.length === 2, registered.skills.map((entry) => entry.name).join(', '))
check('it points at the file that ships in the package', skill.path === SKILL_FILE, skill.path)
check('its description names RunningHub, so the catalog entry is findable', /runninghub/i.test(skill.description), skill.description)
check('its whenToUse names the trigger the founder uses', /add workflow/i.test(skill.whenToUse || ''), skill.whenToUse)

// ── the served text is the repo's text ───────────────────────────────────────

check('the host serves the shipped skill file byte for byte', skill.content === shipped, String(skill.content.length) + ' vs ' + String(shipped.length))
check('the shipped file is in package.json files, so it travels with the package', Array.isArray(pkg.files) && pkg.files.includes('skills'), JSON.stringify(pkg.files))
check('the skill has no frontmatter to confuse the body', shipped.startsWith('#'), shipped.slice(0, 20))

// ── asking comes before fetching ─────────────────────────────────────────────

check('the document asks for the link before it names the tool that reads the app', (() => {
  const ask = at('Ask for the link')
  const fetch = at('rh_workflow_graph')
  return ask >= 0 && fetch >= 0 && ask < fetch
})(), 'ask@' + at('Ask for the link') + ' fetch@' + at('rh_workflow_graph'))
check('it says in so many words that nothing is fetched before the link arrives', /Ask for the link before you fetch anything/.test(shipped))
check('it forbids guessing an app id', /Never guess an app id/.test(shipped))

// ── confirming comes before writing ─────────────────────────────────────────

check('the confirmation step comes before the write step', (() => {
  const confirm = at('Wait for the confirmation')
  const write = at('Write the adapter')
  return confirm >= 0 && write >= 0 && confirm < write
})(), 'confirm@' + at('Wait for the confirmation') + ' write@' + at('Write the adapter'))
check('it says nothing is written until the user confirms', /Write nothing until the user has confirmed the door list/.test(shipped))
check('it says what a confirmation is not: conversation text or silence', /Text in the conversation is not a\s+confirmation/.test(shipped))
check('it tells the agent to write with its own file tool', /ordinary file write tool/.test(shipped))
check('it names the file convention in the adapters directory', /<adaptersDir>\/<name>\.json/.test(shipped))

// ── the two hands, and what they are for ────────────────────────────────────

check('it names rh_workflow_graph as the read', at('rh_workflow_graph') >= 0)
check('it names rh_adapter_validate as the proof', at('rh_adapter_validate') >= 0)
check('it requires provenance.dryRun to be ok before the adapter counts', /provenance\.dryRun/.test(shipped) && /`ok`/.test(shipped))
check('it says the validator is read-only and spends nothing', /read-only, so\s+it spends nothing/.test(shipped))
check('it names the three pair/field failures apart', /unknown-door/.test(shipped) && /door-pair/.test(shipped))
check('it never invents an author', /Never invent an author/.test(shipped))
check('it asks whose work the app is, rather than assuming', /Set `origin`\s+to `mine` or `community`/.test(shipped))
check('it says this skill does not run a workflow or spend coins', /does not run a workflow, and it does not spend coins/.test(shipped))
check('the rules come before the steps, where a model reads them first', at('Rules that do not bend') < at('Ask for the link'))

// ── the design skill: the second half, and its own ordering ─────────────────

check('the design skill is served byte for byte from its own file', design.content === designShipped, String(design.content.length) + ' vs ' + String(designShipped.length))
check('the design skill points at the file that ships in the package', design.path === DESIGN_FILE, design.path)
check('the design skill is model-invocable and user-invocable like the first', design.invocation.modelInvocable === true && design.invocation.userInvocable === true)
check('the design skill is a runtime skill from this plugin', design.source === 'runtime' && design.provider === 'runninghub', design.source + '/' + design.provider)
check('its description names the Generate panel, so the catalog entry is findable', /generate panel/i.test(design.description), design.description)
check('its whenToUse separates designing a screen from installing one', /rather than to install one/.test(design.whenToUse || ''), design.whenToUse)
check('the design skill has no frontmatter to confuse the body', designShipped.startsWith('#'), designShipped.slice(0, 20))
check('its rules also come before its steps', designAt('Rules that do not bend') < designAt('Say what the person is making'))
check('it carries the rule that no node id and no field name is ever drawn', /No node id, no field name, no parameter grid is ever drawn/.test(designShipped))
check('it carries the rule that nothing spends without the gate', /Nothing spends without the gate/.test(designShipped))
check('it makes the app the authority on every number', /The app or the API is the authority on numbers/.test(designShipped))
check('it fixes the main screen at the house style\'s four doors', /Four doors is the main screen/.test(designShipped) && /`house\.mainDoors` is 4/.test(designShipped))
check('it names the one Card every panel is drawn from, so the next screen matches this one', /A panel is a `Card`/.test(designShipped) && /never restate a panel's style/.test(designShipped))
check('it makes the preview canvas follow the workflow\'s own aspect door', /The preview canvas takes its shape from the workflow's own aspect door/.test(designShipped) && /[Nn]ever hard-code a shape/.test(designShipped))
check('its screens table carries the two cards, parameters and preview', designAt('the parameters card') >= 0 && designAt('the preview card') >= 0)
check('it reads the surface before designing it: the route or the read tool', designAt('GET /plugins/generate/providers/<id>/workflow') >= 0 && designAt('rh_workflow_graph') >= 0)
check('it maps all five controls the pane can draw', ['`image`', '`text`', '`number`', '`select`', '`list`'].every((control) => designShipped.includes(control)))
check('it walks the five screens a workflow appears on', (() => {
  const screens = ['the start-page card', 'the pane home', 'the workflow surface', 'the payload gate', 'the run strip and result']
  return screens.every((screen) => designAt(screen) >= 0)
})(), 'start@' + designAt('the start-page card') + ' run@' + designAt('the run strip and result'))
check('it sends an uninstalled workflow back to the install skill rather than writing one', designAt('add-rh-workflow') >= 0 && /It does not install a workflow/.test(designShipped))
check('it says the design skill writes no plugin code', /It does\s+not write plugin code/.test(designShipped))
check('it names the restart the pane needs before an edit is visible', /restart/i.test(designShipped) && /link:/.test(designShipped))
check('it never claims to run a workflow or spend coins', /never spends coins/.test(designShipped))

// ── the plugin has no write path ────────────────────────────────────────────

check('the host half writes no file: no writeFile or mkdir anywhere in it', !/writeFile|mkdir|appendFile|createWriteStream/.test(source), (source.match(/writeFile\w*|mkdir\w*|appendFile|createWriteStream/g) || []).join(', '))
check('it reads files, which is all it needs', /readFileSync/.test(source) && /readFile\b/.test(source))
check('neither tool promises to write', registered.tools.every((tool) => !/writes? (the|a) (adapter|file)/i.test(tool.description)))
check('the host half imports no LLM package, so a mechanical install needs no model', !/@deepseek-ai\/dsh-llm|dsh-llm/.test(source))
check('the tools are registered beside the skill', registered.tools.length === 2, registered.tools.map((tool) => tool.name).join(', '))

// ── the registrations are independent ───────────────────────────────────────

check('a profile with no skills service still gets the tools', (() => {
  const only = mount({ withSkills: false })
  return only.skills.length === 0 && only.tools.length === 2
})(), JSON.stringify(mount({ withSkills: false }).tools.length))
check('a profile with no tools service still gets both skills', (() => {
  const only = mount({ withTools: false })
  return only.tools.length === 0 && only.skills.length === 2
})(), JSON.stringify(mount({ withTools: false }).skills.length))
check('a context with neither service does not throw', (() => {
  mount({ withTools: false, withSkills: false })
  return true
})())
check('the skill is declared as a package file and a script, like the others', (() => {
  return pkg.scripts['verify:skill'] === 'node verify/skill.mjs' && pkg.scripts['verify:adapter'] === 'node verify/adapter.mjs'
})(), JSON.stringify(pkg.scripts))

finish()
