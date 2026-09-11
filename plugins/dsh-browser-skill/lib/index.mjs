import Schema from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
//#region src/archive-cleanup.ts
/** Cap on lineage walks — defensive against a malformed parent chain. */
const MAX_LINEAGE_DEPTH = 16;
/**
* The DSH session ids that own a tool call's browser sessions: the calling
* agent's own session plus every ancestor along the seed lineage. Empty
* when the call carried no agent identity (those sessions outlive any
* archive cleanup by design — nothing can name their owner).
*/
function ownerSessionIds(ctx, agentId) {
	if (agentId === void 0) return [];
	const store = ctx.get("sessions");
	const ids = [];
	let current = agentId;
	for (let depth = 0; current !== void 0 && depth < MAX_LINEAGE_DEPTH; depth += 1) {
		if (ids.includes(current)) break;
		ids.push(current);
		current = store?.get(current)?.header.parentSession;
	}
	return ids;
}
/**
* Watch conversation archival and stop the bsk sessions it opened. Returns
* the disposer (plugin unload). In compositions without the workspace
* domain (headless), the event simply never fires — and a context without
* the events mixin degrades to a no-op like the other optional seams.
*/
function armArchiveCleanup(ctx, registry, observation) {
	const on = ctx.on;
	if (typeof on !== "function") return () => {};
	/** Archived ids already accounted for; lazily seeded from the registry. */
	let seen;
	const initialize = () => {
		if (seen === void 0) {
			const registryService = ctx.get("workspaceRegistry");
			seen = new Set(registryService?.archivedSessionIds ?? []);
		}
		return seen;
	};
	return on.call(ctx, "domain/changed", (change) => {
		if (change?.domain !== "workspace" || change?.table !== "") return;
		const archived = change.value?.archivedSessionIds;
		if (!Array.isArray(archived)) return;
		const previous = initialize();
		const fresh = archived.filter((id) => typeof id === "string" && !previous.has(id));
		seen = new Set(archived.filter((id) => typeof id === "string"));
		for (const dshSessionId of fresh) for (const sessionId of registry.ownedByDsh(dshSessionId)) observation.stopSession(sessionId).catch(() => {});
	});
}
//#endregion
//#region src/tool-params.ts
/** Shared model-facing parameter schemas for browser tools. */
const SESSION_PARAM = {
	type: "string",
	description: "bsk session id to act on; must be one created by browser_session with action=start. Omit to use the current session (the one most recently started or used)."
};
const TAB_ID_PARAM = {
	type: "integer",
	description: "Target tab id. Omit to use the Agent Window's active tab."
};
const WAIT_UNTIL_PARAM = {
	type: "string",
	enum: [
		"load",
		"domcontentloaded",
		"networkidle",
		"commit"
	],
	description: "Page lifecycle phase to wait for (default: load)."
};
const TIMEOUT_MS_PARAM = {
	type: "integer",
	description: "Command timeout in milliseconds; must be greater than zero."
};
//#endregion
//#region src/image.ts
/**
* Sniff the image media type from magic bytes. The capture path can hand back
* JPEG (e.g. `chrome.tabs.captureVisibleTab` on some Chromium/Edge builds
* returning JPEG regardless of the requested format), so the declared type can
* never be trusted from the file extension alone.
* @param data - first bytes of the capture.
* @returns the detected media type, or undefined when unrecognized.
*/
function sniffImageMediaType(data) {
	if (data.length >= 4) {
		if (data[0] === 137 && data[1] === 80 && data[2] === 78 && data[3] === 71) return "image/png";
		if (data[0] === 255 && data[1] === 216 && data[2] === 255) return "image/jpeg";
		if (data[0] === 82 && data[1] === 73 && data[2] === 70 && data[3] === 70 && data.length >= 12 && data[8] === 87 && data[9] === 69 && data[10] === 66 && data[11] === 80) return "image/webp";
		if (data[0] === 71 && data[1] === 73 && data[2] === 70 && data[3] === 56 && data.length >= 6 && (data[4] === 55 || data[4] === 57) && data[5] === 97) return "image/gif";
	}
}
/**
* Commit screenshot bytes to the host attachment store when the composition
* supports durable images on the current model route.
* @returns the durable reference, or undefined to stay in path-only mode.
*/
async function trySaveScreenshot(ctx, exec, data, name) {
	const attachments = ctx.get("attachments");
	if (attachments === void 0) return void 0;
	const mediaType = sniffImageMediaType(data);
	if (mediaType === void 0) return void 0;
	if (!attachments.imageLimits.mediaTypes.includes(mediaType)) return void 0;
	if (data.byteLength > Math.min(attachments.imageLimits.maxImageBytes, attachments.imageLimits.maxMessageImageBytes)) return;
	if (!await isImageCapableRoute(ctx, exec)) return void 0;
	try {
		return await attachments.saveImage({
			data,
			mediaType,
			name
		});
	} catch {
		return;
	}
}
/**
* Best-effort check that the calling route's model accepts image input,
* mirroring dsh-tool-fs `read_image`. Unknown route / missing llm service
* answers false (refuse to attach) so history never gains an image block a
* text-only adapter cannot replay.
*/
async function isImageCapableRoute(ctx, exec) {
	const llm = ctx.get("llm");
	const provider = exec.agent?.session.requestHeader()?.config.provider ?? exec.agent?.options.provider;
	const model = exec.agent?.session.requestHeader()?.config.model ?? exec.agent?.options.model;
	if (llm === void 0 || provider === void 0 || model === void 0) return false;
	try {
		return (await llm.resolveModelInfo(provider, model, exec.signal)).inputModalities?.includes("image") ?? false;
	} catch {
		return false;
	}
}
//#endregion
//#region src/runner.ts
/**
* Process runner for the `bsk` CLI. Every model-facing tool in this plugin
* maps to one `bsk <cmd> --json` invocation: spawn the child, capture
* stdout/stderr, honor the dsh cancellation signal by killing the child, and
* map the CLI's JSON error envelope onto a thrown `BskError`.
*/
/** A failed `bsk` invocation (non-zero exit, timeout, or spawn failure). */
var BskError = class extends Error {
	code;
	hint;
	exitCode;
	timedOut;
	constructor(message, options = {}) {
		super(message);
		this.name = "BskError";
		this.code = options.code;
		this.hint = options.hint;
		this.exitCode = options.exitCode;
		this.timedOut = options.timedOut ?? false;
	}
};
const KILL_GRACE_MS = 3e3;
const SESSION_BUSY_RETRY_DELAY_MS = 100;
function createBskRunner(bskPath, spawnImpl = spawn) {
	const live = /* @__PURE__ */ new Map();
	function killChild(child) {
		if (child.exitCode !== null || child.signalCode !== null) return;
		child.kill("SIGINT");
		setTimeout(() => {
			if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
		}, KILL_GRACE_MS).unref();
	}
	return {
		run(args, options = {}) {
			return new Promise((resolve, reject) => {
				let child;
				try {
					child = spawnImpl(bskPath, [...args, "--json"]);
				} catch (error) {
					reject(error);
					return;
				}
				live.set(child, options.tag);
				let stdout = "";
				let stderr = "";
				let timedOut = false;
				let aborted = false;
				child.stdout?.on("data", (chunk) => {
					stdout += chunk;
				});
				child.stderr?.on("data", (chunk) => {
					stderr += chunk;
				});
				const timeoutMs = options.timeoutMs;
				const timer = timeoutMs !== void 0 && timeoutMs > 0 ? setTimeout(() => {
					timedOut = true;
					killChild(child);
				}, timeoutMs) : void 0;
				timer?.unref();
				const onAbort = () => {
					aborted = true;
					killChild(child);
				};
				if (options.signal?.aborted) onAbort();
				else options.signal?.addEventListener("abort", onAbort, { once: true });
				const settle = () => {
					if (timer !== void 0) clearTimeout(timer);
					options.signal?.removeEventListener("abort", onAbort);
					live.delete(child);
				};
				child.on("error", (error) => {
					settle();
					reject(error);
				});
				child.on("close", (code) => {
					settle();
					resolve({
						code,
						stdout,
						stderr,
						timedOut,
						aborted
					});
				});
			});
		},
		killAll() {
			for (const child of live.keys()) killChild(child);
		},
		killFor(tag) {
			let killed = 0;
			for (const [child, childTag] of live) if (childTag === tag) {
				killChild(child);
				killed += 1;
			}
			return killed;
		}
	};
}
/** True when the spawn failure means the bsk binary itself is missing. */
function isCommandNotFound(error) {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
/** True only for the daemon's transient per-session reconciliation window. */
function isSessionBusyResult(result) {
	if (result.code === 0) return false;
	try {
		const body = JSON.parse(result.stdout);
		return (typeof body.data === "object" && body.data !== null && "reason" in body.data ? body.data.reason : void 0) === "session_busy";
	} catch {
		return false;
	}
}
/**
* Retry exactly once after the tiny daemon-settlement race that can follow a
* graceful SIGINT cancellation. Other errors and persistent busy states stay
* visible to callers.
*/
async function runWithSessionBusyRetry(run, signal) {
	const first = await run();
	if (!isSessionBusyResult(first)) return first;
	await abortableDelay(SESSION_BUSY_RETRY_DELAY_MS, signal);
	return run();
}
function abortableDelay(ms, signal) {
	if (signal?.aborted) return Promise.reject(abortError$3());
	return new Promise((resolve, reject) => {
		const timer = setTimeout(done, ms);
		timer.unref();
		const onAbort = () => {
			clearTimeout(timer);
			signal?.removeEventListener("abort", onAbort);
			reject(abortError$3());
		};
		function done() {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}
function abortError$3() {
	const error = /* @__PURE__ */ new Error("tool call aborted");
	error.name = "AbortError";
	return error;
}
/** Install guidance shown when the bsk CLI cannot be spawned. */
function bskInstallMessage(bskPath) {
	return `the bsk CLI ("${bskPath}") was not found. BrowserSkill must be installed and on PATH for browser tools to work — install it from https://github.com/Tencent/BrowserSkill (see the README install script or \`cargo install\`), then retry.`;
}
/**
* Interpret one finished run: throw `BskError` on timeout / non-zero exit
* (parsing the CLI's JSON error envelope when present), otherwise parse and
* return the stdout JSON payload.
*/
function parseBskJson(result, commandLabel) {
	if (result.timedOut) throw new BskError(`bsk ${commandLabel} timed out`, { timedOut: true });
	const body = result.stdout.trim();
	if (result.code === null && !result.aborted && !result.timedOut) throw new BskError(`bsk ${commandLabel} was interrupted (process killed)`);
	if (result.code !== 0) {
		let parsed;
		try {
			parsed = JSON.parse(body);
		} catch {
			parsed = void 0;
		}
		const message = parsed?.message ?? (result.stderr.trim() || body || `bsk ${commandLabel} failed`);
		throw new BskError(`bsk ${commandLabel} failed: ${parsed?.hint !== void 0 ? `${message} (hint: ${parsed.hint})` : message}`, {
			code: parsed?.code,
			hint: parsed?.hint,
			exitCode: result.code
		});
	}
	try {
		return JSON.parse(body);
	} catch {
		throw new BskError(`bsk ${commandLabel} did not produce JSON output: ${body.slice(0, 200) || "(empty)"}`, { exitCode: result.code });
	}
}
//#endregion
//#region src/observation.ts
/**
* ObservationService: per-owned-session live observation state for the PiP
* overlay — current action, page url, and a breathing thumbnail identified by
* an ephemeral frame id. Frames live in a per-session 2-slot ring in process
* memory (never the durable attachment store). Strict ownership boundary
* applies throughout: only sessions in the plugin's SessionRegistry (owned by
* construction) ever get an observation entry, and interrupt/kill paths can
* only reach children this plugin spawned.
*
* Observation traffic isolation: thumbnail captures run through the runner
* directly (never through the tool-level instrumentation), emit no action
* events, and never move the registry's current pointer.
*/
const DEFAULT_SCHEDULER = {
	setTimeout: (fn, ms) => {
		const timer = setTimeout(fn, ms);
		if (typeof timer === "object" && typeof timer.unref === "function") timer.unref();
		return timer;
	},
	clearTimeout: (h) => clearTimeout(h),
	now: () => Date.now()
};
/** Max consecutive capture failures before a session drops to the idle cadence. */
const FAILURE_BACKOFF_THRESHOLD = 3;
/** Current + previous frame, so an in-flight HTTP fetch of the old id still lands. */
const FRAME_RING_SIZE = 2;
var ObservationService = class {
	deps;
	scratchNamespace = randomUUID();
	observations = /* @__PURE__ */ new Map();
	listeners = /* @__PURE__ */ new Set();
	captureTimers = /* @__PURE__ */ new Map();
	captureInFlight = /* @__PURE__ */ new Set();
	/** Captures intentionally cancelled to make way for foreground work. */
	capturePreempted = /* @__PURE__ */ new Set();
	/** Number of queued/running model-facing calls that currently outrank thumbnails. */
	foregroundDepth = /* @__PURE__ */ new Map();
	captureFailures = /* @__PURE__ */ new Map();
	lastActivity = /* @__PURE__ */ new Map();
	/** Ephemeral frame id → PNG bytes. Only the live ring members are present. */
	frames = /* @__PURE__ */ new Map();
	/** sessionId → oldest-first frame ids, length ≤ FRAME_RING_SIZE. */
	rings = /* @__PURE__ */ new Map();
	/** sessionId → sha256 of the current frame (skip republish when unchanged). */
	hashes = /* @__PURE__ */ new Map();
	/** sessionId → last issued sequence number. */
	seqs = /* @__PURE__ */ new Map();
	/** Consecutive capture failures across ALL sessions (daemon-level signal). */
	globalFailures = 0;
	available = true;
	disposed = false;
	constructor(deps) {
		this.deps = deps;
	}
	get scheduler() {
		return this.deps.scheduler ?? DEFAULT_SCHEDULER;
	}
	/** All current entries (client initial/resync snapshot). */
	getState() {
		return [...this.observations.values()].map((entry) => ({ ...entry }));
	}
	/** Whether the browser side looks reachable (drives the "browser unavailable" state). */
	isAvailable() {
		return this.available;
	}
	setAvailable(available) {
		if (this.available === available) return;
		this.available = available;
		this.emit({
			type: "availability",
			available
		});
	}
	/** Subscribe to incremental changes; returns an unsubscribe function. */
	subscribe(listener) {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
	emit(event) {
		for (const listener of [...this.listeners]) try {
			listener(event);
		} catch {}
	}
	put(entry) {
		this.observations.set(entry.sessionId, entry);
		this.emit({
			type: "upsert",
			session: { ...entry }
		});
	}
	/** Register a fresh owned session (called from browser_session action=start). */
	addSession(sessionId, url) {
		if (!this.deps.options.enabled || this.disposed) return;
		const dshSessionIds = this.deps.registry.dshOwnersOf(sessionId);
		this.put({
			sessionId,
			...url !== void 0 ? { url } : {},
			action: "idle",
			since: this.scheduler.now(),
			...dshSessionIds.length > 0 ? { dshSessionIds } : {}
		});
		this.lastActivity.set(sessionId, this.scheduler.now());
		this.scheduleCapture(sessionId, 0);
	}
	/** Drop a session (called from browser_session action=stop). */
	removeSession(sessionId) {
		this.cancelCapture(sessionId);
		this.foregroundDepth.delete(sessionId);
		this.capturePreempted.delete(sessionId);
		this.captureFailures.delete(sessionId);
		this.lastActivity.delete(sessionId);
		this.dropSessionFrames(sessionId);
		if (this.observations.delete(sessionId)) this.emit({
			type: "remove",
			session: {
				sessionId,
				action: "idle",
				since: this.scheduler.now()
			}
		});
	}
	/**
	* Give model-facing work priority over the best-effort thumbnail lane.
	* The first lease cancels a pending timer and gracefully interrupts an
	* active bsk screenshot; the last release schedules one fresh frame.
	*/
	acquireForeground(sessionId) {
		if (!this.deps.options.enabled || this.disposed || !this.observations.has(sessionId)) return () => {};
		const depth = this.foregroundDepth.get(sessionId) ?? 0;
		this.foregroundDepth.set(sessionId, depth + 1);
		if (depth === 0) {
			this.cancelCapture(sessionId);
			if (this.deps.runner.killFor(`observation:${sessionId}`) > 0) this.capturePreempted.add(sessionId);
		}
		let released = false;
		return () => {
			if (released) return;
			released = true;
			const remaining = (this.foregroundDepth.get(sessionId) ?? 1) - 1;
			if (remaining > 0) {
				this.foregroundDepth.set(sessionId, remaining);
				return;
			}
			this.foregroundDepth.delete(sessionId);
			if (!this.disposed && this.observations.has(sessionId)) this.scheduleCapture(sessionId, 0);
		};
	}
	/** Mark an action starting on a session (tool entry instrumentation). */
	beginAction(sessionId, action) {
		if (!this.deps.options.enabled || this.disposed) return;
		const entry = this.observations.get(sessionId);
		if (entry === void 0 || entry.dead === true) return;
		const now = this.scheduler.now();
		this.lastActivity.set(sessionId, now);
		const next = {
			...entry,
			action,
			since: now
		};
		delete next.lastError;
		this.put(next);
	}
	/**
	* Mark the current action settling (tool exit instrumentation). Triggers an
	* immediate thumbnail refresh — action-driven first, timer as fallback.
	*/
	endAction(sessionId, error) {
		if (!this.deps.options.enabled || this.disposed) return;
		const entry = this.observations.get(sessionId);
		if (entry === void 0 || entry.dead === true) return;
		const now = this.scheduler.now();
		this.lastActivity.set(sessionId, now);
		const next = {
			...entry,
			action: "idle",
			since: now
		};
		if (error !== void 0) next.lastError = error;
		else delete next.lastError;
		this.put(next);
		if (!this.foregroundDepth.has(sessionId)) this.scheduleCapture(sessionId, 0);
	}
	/** Record the settled page URL (navigate success / start with url). */
	setUrl(sessionId, url) {
		if (!this.deps.options.enabled || this.disposed) return;
		const entry = this.observations.get(sessionId);
		if (entry === void 0) return;
		this.put({
			...entry,
			url
		});
	}
	/**
	* Interrupt the in-flight call of one session (default: the registry's
	* current). Kills exactly the bsk children this plugin spawned for that
	* session — same user-visible semantics as the chat Stop button (the in-flight
	* tool call fails; the agent flow may continue).
	* @returns whether an in-flight call was actually interrupted.
	*/
	interrupt(sessionId) {
		const target = sessionId ?? this.deps.registry.current();
		if (target === void 0 || !this.deps.registry.isOwned(target)) return false;
		return this.deps.runner.killFor(target) > 0;
	}
	/**
	* Stop one owned session and close its Agent Window (the overlay's stop
	* button — same end state as `browser_session` action=stop). Never waits behind a
	* hung in-flight command: tool children are killed first so the session's
	* keyed queue drains immediately, and no further captures queue up. A
	* session the daemon already forgot stops idempotently — the goal state
	* (entry gone) is identical.
	* @returns false only for a foreign session; bsk failures reject so callers
	* can preserve the structured error instead of silently leaving a ghost.
	*/
	async stopSession(sessionId, signal) {
		if (!this.deps.registry.isOwned(sessionId)) return false;
		const releaseForeground = this.acquireForeground(sessionId);
		let actionError;
		this.beginAction(sessionId, "stopping");
		try {
			this.deps.runner.killFor(sessionId);
			const result = await this.deps.queue.run(sessionId, () => runWithSessionBusyRetry(() => this.deps.runner.run([
				"session",
				"stop",
				sessionId
			], {
				signal,
				timeoutMs: 3e4,
				tag: sessionId
			}), signal), signal);
			if (result.aborted) throw abortError$2();
			try {
				parseBskJson(result, "session stop");
			} catch (error) {
				if (!isSessionNotFoundError(error)) throw error;
			}
			this.deps.registry.remove(sessionId);
			this.removeSession(sessionId);
			return true;
		} catch (error) {
			actionError = error instanceof Error ? error.message.split("\n")[0] : String(error);
			throw error;
		} finally {
			this.endAction(sessionId, actionError);
			releaseForeground();
		}
	}
	/**
	* Read one captured thumbnail from the in-process ring. Powers the plugin's
	* own HTTP thumbnail route — frames are plugin-owned runtime data, never
	* referenced by any session log, so the session-authorized client RPC
	* cannot serve them.
	*/
	async readThumbnail(attachmentId) {
		const frame = this.frames.get(attachmentId);
		if (frame === void 0) return void 0;
		return {
			data: frame.data,
			mediaType: frame.mediaType
		};
	}
	/** Tear down all state and timers (plugin dispose). */
	dispose() {
		this.disposed = true;
		for (const sessionId of [...this.captureTimers.keys()]) this.cancelCapture(sessionId);
		this.captureTimers.clear();
		this.captureInFlight.clear();
		this.capturePreempted.clear();
		this.foregroundDepth.clear();
		this.captureFailures.clear();
		this.lastActivity.clear();
		this.frames.clear();
		this.rings.clear();
		this.hashes.clear();
		this.seqs.clear();
		this.observations.clear();
		this.emit({ type: "reset" });
		this.listeners.clear();
	}
	cancelCapture(sessionId) {
		const timer = this.captureTimers.get(sessionId);
		if (timer !== void 0) {
			this.scheduler.clearTimeout(timer);
			this.captureTimers.delete(sessionId);
		}
	}
	/** Schedule the next capture for a session; `delayMs` 0 means "as soon as the event loop allows". */
	scheduleCapture(sessionId, delayMs) {
		if (!this.deps.options.enabled || this.disposed) return;
		if (this.foregroundDepth.has(sessionId)) return;
		const entry = this.observations.get(sessionId);
		if (entry === void 0 || entry.dead === true) return;
		this.cancelCapture(sessionId);
		const now = this.scheduler.now();
		const lastSeen = this.lastActivity.get(sessionId) ?? 0;
		const failures = this.captureFailures.get(sessionId) ?? 0;
		const { thumbnailIntervalMs, idleIntervalMs } = this.deps.options;
		const cadence = now - lastSeen < idleIntervalMs && failures < FAILURE_BACKOFF_THRESHOLD ? thumbnailIntervalMs : idleIntervalMs;
		const delay = delayMs ?? cadence;
		const timer = this.scheduler.setTimeout(() => {
			this.captureTimers.delete(sessionId);
			this.capture(sessionId);
		}, delay);
		this.captureTimers.set(sessionId, timer);
	}
	/**
	* Capture one frame: `bsk screenshot --json` through the runner, bytes into
	* the in-process ring, id onto the observation. Runs OUTSIDE the tool
	* instrumentation on purpose — no action events, no registry writes.
	* Failures keep the previous frame and back off silently.
	*/
	async capture(sessionId) {
		if (this.disposed) return;
		const current = this.observations.get(sessionId);
		if (current === void 0 || current.dead === true) return;
		if (this.captureInFlight.has(sessionId)) return;
		this.captureInFlight.add(sessionId);
		const sessionKey = createHash("sha256").update(sessionId).digest("hex").slice(0, 16);
		const outPath = join(tmpdir(), `bsk-obs-${this.scratchNamespace}-${sessionKey}.png`);
		let writtenPath = outPath;
		try {
			const result = await this.deps.queue.run(sessionId, () => {
				if (this.foregroundDepth.has(sessionId)) return Promise.resolve(void 0);
				return this.deps.runner.run([
					"screenshot",
					"--session",
					sessionId,
					"--out",
					outPath
				], {
					timeoutMs: 15e3,
					tag: `observation:${sessionId}`
				});
			});
			if (result === void 0) return;
			if (result.code !== 0) {
				let code;
				try {
					code = JSON.parse(result.stdout).code;
				} catch {
					code = void 0;
				}
				if (isSessionNotFoundCode(code)) {
					this.deps.registry.remove(sessionId);
					this.removeSession(sessionId);
					return;
				}
				throw new Error(`screenshot exited ${result.code}`);
			}
			writtenPath = JSON.parse(result.stdout).path ?? outPath;
			const data = await readFile(writtenPath);
			const entry = this.observations.get(sessionId);
			if (entry === void 0) return;
			this.captureFailures.delete(sessionId);
			this.globalFailures = 0;
			this.setAvailable(true);
			this.publishFrame(sessionId, entry, data);
		} catch {
			if (!this.capturePreempted.delete(sessionId)) {
				this.captureFailures.set(sessionId, (this.captureFailures.get(sessionId) ?? 0) + 1);
				this.globalFailures += 1;
				if (this.globalFailures >= FAILURE_BACKOFF_THRESHOLD) this.setAvailable(false);
			}
		} finally {
			await unlink(writtenPath).catch(() => {});
			this.capturePreempted.delete(sessionId);
			this.captureInFlight.delete(sessionId);
			if (!this.disposed && this.observations.has(sessionId)) this.scheduleCapture(sessionId);
		}
	}
	/** Insert a new frame, or no-op when the PNG bytes match the current one. */
	publishFrame(sessionId, entry, data) {
		const hash = createHash("sha256").update(data).digest("hex");
		if (this.hashes.get(sessionId) === hash) return;
		const seq = (this.seqs.get(sessionId) ?? 0) + 1;
		this.seqs.set(sessionId, seq);
		const id = `obs-${sessionId}-${seq}`;
		this.frames.set(id, {
			data,
			mediaType: sniffImageMediaType(data) ?? "image/png"
		});
		this.hashes.set(sessionId, hash);
		const ring = this.rings.get(sessionId) ?? [];
		ring.push(id);
		while (ring.length > FRAME_RING_SIZE) {
			const evicted = ring.shift();
			if (evicted !== void 0) this.frames.delete(evicted);
		}
		this.rings.set(sessionId, ring);
		this.put({
			...entry,
			thumbnailAttachmentId: id
		});
	}
	dropSessionFrames(sessionId) {
		for (const id of this.rings.get(sessionId) ?? []) this.frames.delete(id);
		this.rings.delete(sessionId);
		this.hashes.delete(sessionId);
		this.seqs.delete(sessionId);
	}
};
function isSessionNotFoundCode(code) {
	return code === "not_found" || code === "session_not_found";
}
function isSessionNotFoundError(error) {
	return error instanceof BskError && isSessionNotFoundCode(error.code);
}
function abortError$2() {
	const error = /* @__PURE__ */ new Error("tool call aborted");
	error.name = "AbortError";
	return error;
}
/** Map a bsk command label onto its observation action verb. */
function actionForLabel(label) {
	switch (label) {
		case "session start": return "starting";
		case "session stop": return "stopping";
		case "navigate": return "navigating";
		case "snapshot": return "snapshotting";
		case "observe": return "observing";
		case "click": return "clicking";
		case "hover": return "hovering";
		case "fill": return "filling";
		case "select": return "selecting";
		case "press": return "pressing";
		case "screenshot": return "capturing";
		case "emulate": return "emulating";
		case "tab list": return "listing tabs";
		case "tab create": return "creating tab";
		case "tab close": return "closing tab";
		case "tab select": return "selecting tab";
		case "tab borrow": return "borrowing tab";
		case "tab return": return "returning tab";
		case "navigate-back": return "navigating back";
		case "navigate-forward": return "navigating forward";
		case "reload": return "reloading";
		case "wait-for-navigation": return "waiting for navigation";
		case "request-help": return "waiting for user";
		case "get-html": return "reading HTML";
		case "console": return "reading console";
		case "network": return "reading network";
		case "window resize": return "resizing window";
		default: return label;
	}
}
//#endregion
//#region src/phase-one-runtime.ts
function requireNonEmpty(value, name) {
	if (value.trim().length === 0) throw new Error(`${name} must be a non-empty string`);
}
function requirePositive(value, name) {
	if (value !== void 0 && value <= 0) throw new Error(`${name} must be greater than zero`);
}
/** CLI positional target detection is shared by hover/select/request-help. */
function isSnapshotRef(target) {
	return /^@?e\d+$/.test(target);
}
/**
* Give the child enough time to honour a command-level timeout plus IPC
* settlement slack, without shortening the plugin's configured default.
*/
function runnerTimeout(deps, commandTimeoutMs) {
	if (commandTimeoutMs === void 0) return deps.config.defaultTimeoutMs;
	return Math.max(deps.config.defaultTimeoutMs, commandTimeoutMs + 15e3);
}
function appendTarget(args, target) {
	args.push(target);
}
function appendTabId(args, tabId) {
	if (tabId !== void 0) args.push("--tab-id", String(tabId));
}
function appendWaitOptions(args, waitUntil, timeoutMs) {
	if (waitUntil !== void 0) args.push("--wait-until", waitUntil);
	if (timeoutMs !== void 0) args.push("--timeout", `${timeoutMs}ms`);
}
//#endregion
//#region src/phase-one-tools-interaction.ts
const MODIFIERS = [
	"alt",
	"ctrl",
	"meta",
	"shift"
];
/** Add hover and select without bypassing session ownership or observation. */
function registerPhaseOneInteractionTools(deps, register, runtime) {
	const { registry } = deps;
	register(defineTool({
		name: "interact.hover",
		description: "Move the mouse over a snapshot ref or CSS selector to reveal hover-triggered UI. Run browser_inspect action=observe or snapshot afterwards to discover newly visible refs.",
		parameters: {
			target: {
				type: "string",
				required: true,
				description: "Snapshot ref (@e3 / e3) or CSS selector of the element to hover."
			},
			session: SESSION_PARAM,
			tabId: TAB_ID_PARAM,
			modifiers: {
				type: "array",
				items: {
					type: "string",
					enum: MODIFIERS
				},
				description: "Keyboard modifiers held during the mouse move."
			},
			settleMs: {
				type: "integer",
				description: "Milliseconds to wait for hover-triggered UI to settle (default: 200)."
			},
			timeoutMs: TIMEOUT_MS_PARAM
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					session: {
						type: "string",
						required: true
					},
					tabId: {
						type: "integer",
						required: true
					},
					x: {
						type: "number",
						required: true
					},
					y: {
						type: "number",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `[session ${value.session}] hovered at (${value.x}, ${value.y}) on tab ${value.tabId}`
			}]
		},
		async execute(args, exec) {
			requireNonEmpty(args.target, "target");
			requirePositive(args.timeoutMs, "timeoutMs");
			requirePositive(args.settleMs, "settleMs");
			const sessionId = registry.resolve(args.session, "browser_interact(action=hover)");
			const cmdArgs = [
				"hover",
				"--session",
				sessionId
			];
			appendTabId(cmdArgs, args.tabId);
			if (args.modifiers !== void 0 && args.modifiers.length > 0) cmdArgs.push("--modifiers", args.modifiers.join(","));
			if (args.settleMs !== void 0) cmdArgs.push("--settle", `${args.settleMs}ms`);
			if (args.timeoutMs !== void 0) cmdArgs.push("--timeout", `${args.timeoutMs}ms`);
			appendTarget(cmdArgs, args.target);
			const reply = await runtime.run(exec, cmdArgs, "hover", sessionId, runnerTimeout(deps, args.timeoutMs));
			return {
				session: sessionId,
				tabId: reply.tab_id,
				x: reply.x,
				y: reply.y
			};
		},
		presentCall: (args) => ({
			card: "terminal",
			title: runtime.commandLine([
				"hover",
				args.target,
				"--session",
				args.session ?? "(current)"
			]),
			description: "Hover an element"
		}),
		presentResult: runtime.presentTerminalResult
	}));
	register(defineTool({
		name: "interact.select",
		description: "Set a select element's option values. Pass one value for a normal select or multiple values for a multi-select; values replace the current selection.",
		parameters: {
			target: {
				type: "string",
				required: true,
				description: "Snapshot ref (@e3 / e3) or CSS selector of the select element."
			},
			values: {
				type: "array",
				required: true,
				items: { type: "string" },
				description: "Option value attributes to select; at least one value is required."
			},
			session: SESSION_PARAM,
			tabId: TAB_ID_PARAM,
			timeoutMs: TIMEOUT_MS_PARAM
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					session: {
						type: "string",
						required: true
					},
					tabId: {
						type: "integer",
						required: true
					},
					multiple: {
						type: "boolean",
						required: true
					},
					selectedValues: {
						type: "array",
						required: true,
						items: { type: "string" }
					},
					selectedLabels: {
						type: "array",
						required: true,
						items: { type: "string" }
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `[session ${value.session}] selected ${value.selectedValues.join(", ") || "(none)"} on tab ${value.tabId}`
			}]
		},
		async execute(args, exec) {
			requireNonEmpty(args.target, "target");
			requirePositive(args.timeoutMs, "timeoutMs");
			if (args.values.length === 0) throw new Error("values must contain at least one option");
			const sessionId = registry.resolve(args.session, "browser_interact(action=select)");
			const cmdArgs = [
				"select",
				"--session",
				sessionId
			];
			appendTabId(cmdArgs, args.tabId);
			for (const value of args.values) cmdArgs.push("--value", value);
			if (args.timeoutMs !== void 0) cmdArgs.push("--timeout", `${args.timeoutMs}ms`);
			appendTarget(cmdArgs, args.target);
			const reply = await runtime.run(exec, cmdArgs, "select", sessionId, runnerTimeout(deps, args.timeoutMs));
			return {
				session: sessionId,
				tabId: reply.tab_id,
				multiple: reply.multiple,
				selectedValues: reply.selected_values,
				selectedLabels: reply.selected_labels
			};
		},
		presentCall: (args) => ({
			card: "terminal",
			title: runtime.commandLine([
				"select",
				args.target,
				"--session",
				args.session ?? "(current)"
			]),
			description: `Select ${args.values.length} option${args.values.length === 1 ? "" : "s"}`
		}),
		presentResult: runtime.presentTerminalResult
	}));
}
//#endregion
//#region src/phase-one-tools-navigation.ts
const HISTORY_OUTPUT = {
	type: "object",
	additionalProperties: false,
	properties: {
		session: {
			type: "string",
			required: true
		},
		tabId: {
			type: "integer",
			required: true
		},
		previousUrl: { type: "string" },
		finalUrl: { type: "string" },
		reached: {
			type: "string",
			required: true
		},
		errorText: { type: "string" }
	}
};
function mapHistory(sessionId, reply) {
	return {
		session: sessionId,
		tabId: reply.tab_id,
		...reply.previous_url !== void 0 ? { previousUrl: reply.previous_url } : {},
		...reply.final_url !== void 0 ? { finalUrl: reply.final_url } : {},
		reached: reply.reached,
		...reply.error_text !== void 0 ? { errorText: reply.error_text } : {}
	};
}
/** Add browser history, reload, and explicit lifecycle waiting. */
function registerPhaseOneNavigationTools(deps, register, runtime) {
	const { registry } = deps;
	const registerHistory = (direction) => {
		const toolName = `page.${direction}`;
		const command = `navigate-${direction}`;
		register(defineTool({
			name: toolName,
			description: `Navigate the active Agent Window tab ${direction} by one history entry.`,
			parameters: {
				session: SESSION_PARAM,
				tabId: TAB_ID_PARAM,
				waitUntil: WAIT_UNTIL_PARAM,
				timeoutMs: TIMEOUT_MS_PARAM
			},
			output: {
				schema: HISTORY_OUTPUT,
				render: (_args, value) => [{
					type: "text",
					text: `[session ${value.session}] navigated ${direction} on tab ${value.tabId}` + (value.finalUrl !== void 0 ? ` to ${value.finalUrl}` : "") + ` (reached: ${value.reached})` + (value.errorText !== void 0 ? ` — ${value.errorText}` : "")
				}]
			},
			async execute(args, exec) {
				requirePositive(args.timeoutMs, "timeoutMs");
				const sessionId = registry.resolve(args.session, toolName);
				const cmdArgs = [
					command,
					"--session",
					sessionId
				];
				appendTabId(cmdArgs, args.tabId);
				appendWaitOptions(cmdArgs, args.waitUntil, args.timeoutMs);
				const reply = await runtime.run(exec, cmdArgs, command, sessionId, runnerTimeout(deps, args.timeoutMs));
				if (reply.final_url !== void 0) deps.observation.setUrl(sessionId, reply.final_url);
				return mapHistory(sessionId, reply);
			},
			presentCall: (args) => ({
				card: "terminal",
				title: runtime.commandLine([
					command,
					"--session",
					args.session ?? "(current)"
				]),
				description: `Navigate ${direction}`
			}),
			presentResult: runtime.presentTerminalResult
		}));
	};
	registerHistory("back");
	registerHistory("forward");
	register(defineTool({
		name: "page.reload",
		description: "Reload the active Agent Window tab and wait for a lifecycle phase. Set hard=true to bypass the HTTP cache.",
		parameters: {
			session: SESSION_PARAM,
			tabId: TAB_ID_PARAM,
			waitUntil: WAIT_UNTIL_PARAM,
			timeoutMs: TIMEOUT_MS_PARAM,
			hard: {
				type: "boolean",
				description: "Bypass the HTTP cache while reloading."
			}
		},
		output: {
			schema: HISTORY_OUTPUT,
			render: (_args, value) => [{
				type: "text",
				text: `[session ${value.session}] reloaded tab ${value.tabId}` + (value.finalUrl !== void 0 ? ` at ${value.finalUrl}` : "") + ` (reached: ${value.reached})` + (value.errorText !== void 0 ? ` — ${value.errorText}` : "")
			}]
		},
		async execute(args, exec) {
			requirePositive(args.timeoutMs, "timeoutMs");
			const sessionId = registry.resolve(args.session, "browser_page(action=reload)");
			const cmdArgs = [
				"reload",
				"--session",
				sessionId
			];
			appendTabId(cmdArgs, args.tabId);
			appendWaitOptions(cmdArgs, args.waitUntil, args.timeoutMs);
			if (args.hard === true) cmdArgs.push("--hard");
			const reply = await runtime.run(exec, cmdArgs, "reload", sessionId, runnerTimeout(deps, args.timeoutMs));
			if (reply.final_url !== void 0) deps.observation.setUrl(sessionId, reply.final_url);
			return mapHistory(sessionId, reply);
		},
		presentCall: (args) => ({
			card: "terminal",
			title: runtime.commandLine([
				"reload",
				"--session",
				args.session ?? "(current)",
				...args.hard === true ? ["--hard"] : []
			]),
			description: "Reload the active tab"
		}),
		presentResult: runtime.presentTerminalResult
	}));
	register(defineTool({
		name: "page.wait",
		description: "Wait for a page lifecycle event on the active Agent Window tab. Use after an action that may navigate when the action result itself does not wait for navigation.",
		parameters: {
			session: SESSION_PARAM,
			tabId: TAB_ID_PARAM,
			waitUntil: WAIT_UNTIL_PARAM,
			timeoutMs: TIMEOUT_MS_PARAM
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					session: {
						type: "string",
						required: true
					},
					tabId: {
						type: "integer",
						required: true
					},
					reached: {
						type: "string",
						required: true
					},
					errorText: { type: "string" }
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `[session ${value.session}] navigation wait on tab ${value.tabId}: ${value.reached}` + (value.errorText !== void 0 ? ` — ${value.errorText}` : "")
			}]
		},
		async execute(args, exec) {
			requirePositive(args.timeoutMs, "timeoutMs");
			const sessionId = registry.resolve(args.session, "browser_page(action=wait)");
			const timeoutMs = args.timeoutMs ?? 3e4;
			const cmdArgs = [
				"wait-for-navigation",
				"--session",
				sessionId
			];
			appendTabId(cmdArgs, args.tabId);
			if (args.waitUntil !== void 0) cmdArgs.push("--wait-until", args.waitUntil);
			cmdArgs.push("--timeout", `${timeoutMs}ms`);
			const reply = await runtime.run(exec, cmdArgs, "wait-for-navigation", sessionId, runnerTimeout(deps, timeoutMs));
			return {
				session: sessionId,
				tabId: reply.tab_id,
				reached: reply.reached,
				...reply.error_text !== void 0 ? { errorText: reply.error_text } : {}
			};
		},
		presentCall: (args) => ({
			card: "terminal",
			title: runtime.commandLine([
				"wait-for-navigation",
				"--session",
				args.session ?? "(current)"
			]),
			description: "Wait for page navigation"
		}),
		presentResult: runtime.presentTerminalResult
	}));
}
//#endregion
//#region src/phase-one-tools-support.ts
const HELP_CONDITION_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		urlContains: { type: "string" },
		urlMatches: { type: "string" },
		selectorExists: { type: "string" },
		selectorMissing: { type: "string" },
		textExists: { type: "string" },
		textMissing: { type: "string" }
	}
};
const DEBUG_PARAMETERS = {
	session: SESSION_PARAM,
	tabId: TAB_ID_PARAM,
	since: {
		type: "integer",
		description: "Return entries with a sequence strictly greater than this cursor."
	},
	limit: {
		type: "integer",
		description: "Maximum entries to return (default: 50, daemon cap: 200)."
	},
	maxTextChars: {
		type: "integer",
		description: "Maximum characters per entry text/URL (default: 1000, daemon cap: 4096)."
	}
};
function mapCondition(condition) {
	return {
		...condition.urlContains !== void 0 ? { url_contains: condition.urlContains } : {},
		...condition.urlMatches !== void 0 ? { url_matches: condition.urlMatches } : {},
		...condition.selectorExists !== void 0 ? { selector_exists: condition.selectorExists } : {},
		...condition.selectorMissing !== void 0 ? { selector_missing: condition.selectorMissing } : {},
		...condition.textExists !== void 0 ? { text_exists: condition.textExists } : {},
		...condition.textMissing !== void 0 ? { text_missing: condition.textMissing } : {}
	};
}
function mapCompletionCriteria(criteria) {
	return {
		...criteria.any !== void 0 ? { any: criteria.any.map(mapCondition) } : {},
		...criteria.all !== void 0 ? { all: criteria.all.map(mapCondition) } : {},
		...criteria.stableForMs !== void 0 ? { stable_for_ms: criteria.stableForMs } : {}
	};
}
function validateDebugArgs(args) {
	if (args.since !== void 0 && args.since < 0) throw new Error("since must be zero or greater");
	requirePositive(args.limit, "limit");
	requirePositive(args.maxTextChars, "maxTextChars");
}
function appendDebugOptions(args, options) {
	appendTabId(args, options.tabId);
	if (options.since !== void 0) args.push("--since", String(options.since));
	if (options.limit !== void 0) args.push("--limit", String(options.limit));
	if (options.maxTextChars !== void 0) args.push("--max-text-chars", String(options.maxTextChars));
}
/** Human help, raw HTML, diagnostics, and Agent Window sizing. */
function registerPhaseOneSupportTools(deps, register, runtime) {
	const { registry } = deps;
	register(defineTool({
		name: "assist.request-help",
		description: "Pause browser automation and ask the user to complete an in-page step such as login, captcha, OTP, or confirmation. After continued/completed, observe again before using refs.",
		parameters: {
			prompt: {
				type: "string",
				required: true,
				description: "Clear instructions shown to the user in the browser help overlay."
			},
			session: SESSION_PARAM,
			tabId: TAB_ID_PARAM,
			title: {
				type: "string",
				description: "Optional title for the help overlay."
			},
			targets: {
				type: "array",
				items: { type: "string" },
				description: "Snapshot refs or CSS selectors to scroll to and highlight for the user."
			},
			timeoutMs: {
				...TIMEOUT_MS_PARAM,
				description: "Maximum wait for the user in milliseconds (default: 300000)."
			},
			completionCriteria: {
				type: "object",
				additionalProperties: false,
				description: "Optional explicit success detector for automatic completion.",
				properties: {
					any: {
						type: "array",
						items: HELP_CONDITION_SCHEMA
					},
					all: {
						type: "array",
						items: HELP_CONDITION_SCHEMA
					},
					stableForMs: {
						type: "integer",
						description: "How long criteria must remain true before completing."
					}
				}
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					session: {
						type: "string",
						required: true
					},
					tabId: {
						type: "integer",
						required: true
					},
					outcome: {
						type: "string",
						required: true,
						enum: [
							"continued",
							"cancelled",
							"timed_out",
							"completed",
							"navigated",
							"disabled"
						]
					},
					completedBy: { type: "string" },
					note: { type: "string" },
					resolvedTargets: {
						type: "array",
						items: {
							type: "object",
							additionalProperties: false,
							properties: {
								matched: {
									type: "boolean",
									required: true
								},
								ref: { type: "string" },
								selector: { type: "string" }
							}
						}
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `[session ${value.session}] user help outcome on tab ${value.tabId}: ${value.outcome}` + (value.note !== void 0 ? ` — ${value.note}` : "") + (value.resolvedTargets !== void 0 ? `\ntargets: ${value.resolvedTargets.map((target) => `${target.ref ?? target.selector ?? "(unknown)"}=${target.matched ? "matched" : "not found"}`).join(", ")}` : "")
			}]
		},
		async execute(args, exec) {
			requireNonEmpty(args.prompt, "prompt");
			if (args.title !== void 0) requireNonEmpty(args.title, "title");
			requirePositive(args.timeoutMs, "timeoutMs");
			for (const target of args.targets ?? []) requireNonEmpty(target, "target");
			const criteria = args.completionCriteria;
			if (criteria?.stableForMs !== void 0 && criteria.stableForMs < 0) throw new Error("completionCriteria.stableForMs must be zero or greater");
			const sessionId = registry.resolve(args.session, "browser_assist(action=request-help)");
			const timeoutMs = args.timeoutMs ?? 3e5;
			const cmdArgs = [
				"request-help",
				"--session",
				sessionId,
				"--prompt",
				args.prompt,
				"--timeout",
				`${timeoutMs}ms`
			];
			appendTabId(cmdArgs, args.tabId);
			if (args.title !== void 0) cmdArgs.push("--title", args.title);
			for (const target of args.targets ?? []) cmdArgs.push("--target", target);
			if (criteria !== void 0) cmdArgs.push("--completion-criteria", JSON.stringify(mapCompletionCriteria(criteria)));
			const reply = await runtime.run(exec, cmdArgs, "request-help", sessionId, runnerTimeout(deps, timeoutMs));
			return {
				session: sessionId,
				tabId: reply.tab_id,
				outcome: reply.outcome,
				...reply.completed_by !== void 0 ? { completedBy: reply.completed_by } : {},
				...reply.note !== void 0 ? { note: reply.note } : {},
				...reply.resolved_targets !== void 0 ? { resolvedTargets: reply.resolved_targets } : {}
			};
		},
		presentCall: (args) => ({
			card: "terminal",
			title: runtime.commandLine([
				"request-help",
				"--session",
				args.session ?? "(current)"
			]),
			description: "Ask the user for browser help"
		}),
		presentResult: runtime.presentTerminalResult
	}));
	register(defineTool({
		name: "inspect.html",
		description: "Read raw DOM HTML from the active Agent Window tab, optionally scoped to a fresh snapshot ref. Use only when browser_inspect observe/snapshot cannot answer the question.",
		parameters: {
			session: SESSION_PARAM,
			tabId: TAB_ID_PARAM,
			ref: {
				type: "string",
				description: "Fresh snapshot ref that scopes the HTML subtree."
			},
			maxBytes: {
				type: "integer",
				description: "Maximum returned HTML bytes before truncation (default: 524288)."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					session: {
						type: "string",
						required: true
					},
					tabId: {
						type: "integer",
						required: true
					},
					html: {
						type: "string",
						required: true
					},
					truncated: {
						type: "boolean",
						required: true
					},
					byteSize: {
						type: "integer",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: value.html + (value.truncated ? `\n(HTML truncated; original size ${value.byteSize} bytes)` : "")
			}]
		},
		isConcurrencySafe: () => true,
		async execute(args, exec) {
			if (args.ref !== void 0) {
				requireNonEmpty(args.ref, "ref");
				if (!isSnapshotRef(args.ref)) throw new Error("ref must be a snapshot ref such as @e3");
			}
			requirePositive(args.maxBytes, "maxBytes");
			const sessionId = registry.resolve(args.session, "browser_inspect(action=html)");
			const cmdArgs = [
				"get-html",
				"--session",
				sessionId
			];
			appendTabId(cmdArgs, args.tabId);
			if (args.ref !== void 0) cmdArgs.push("--ref", args.ref);
			if (args.maxBytes !== void 0) cmdArgs.push("--max-bytes", String(args.maxBytes));
			const reply = await runtime.run(exec, cmdArgs, "get-html", sessionId);
			return {
				session: sessionId,
				tabId: reply.tab_id,
				html: reply.html,
				truncated: reply.truncated ?? false,
				byteSize: reply.byte_size
			};
		},
		presentCall: (args) => ({
			card: "terminal",
			title: runtime.commandLine([
				"get-html",
				"--session",
				args.session ?? "(current)",
				...args.ref !== void 0 ? ["--ref", args.ref] : []
			]),
			description: "Read raw page HTML"
		}),
		presentResult: runtime.presentTerminalResult
	}));
	register(defineTool({
		name: "inspect.console",
		description: "Read buffered console messages, browser log entries, and JavaScript exceptions from a tab. This is read-only and does not evaluate JavaScript.",
		parameters: {
			...DEBUG_PARAMETERS,
			includeStack: {
				type: "boolean",
				description: "Include structured stack frames in returned console entries."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					session: {
						type: "string",
						required: true
					},
					tabId: {
						type: "integer",
						required: true
					},
					entries: {
						type: "array",
						required: true,
						items: {
							type: "object",
							additionalProperties: false,
							properties: {
								sequence: {
									type: "integer",
									required: true
								},
								kind: {
									type: "string",
									required: true
								},
								level: {
									type: "string",
									required: true
								},
								text: {
									type: "string",
									required: true
								},
								url: { type: "string" },
								line: { type: "integer" },
								column: { type: "integer" },
								timestamp: { type: "number" },
								stackTrace: {
									type: "array",
									required: true,
									items: {
										type: "object",
										additionalProperties: false,
										properties: {
											functionName: { type: "string" },
											url: { type: "string" },
											line: { type: "integer" },
											column: { type: "integer" }
										}
									}
								},
								truncated: {
									type: "boolean",
									required: true
								}
							}
						}
					},
					nextSince: {
						type: "integer",
						required: true
					},
					truncated: {
						type: "boolean",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: value.entries.length === 0 ? "(no console messages captured)" : value.entries.map((entry) => {
					const location = entry.url === void 0 ? "" : ` ${entry.url}${entry.line !== void 0 ? `:${entry.line}` : ""}${entry.column !== void 0 ? `:${entry.column}` : ""}`;
					const stack = entry.stackTrace.map((frame) => `\n  at ${frame.functionName ?? "<anonymous>"} ${frame.url ?? ""}${frame.line !== void 0 ? `:${frame.line}` : ""}${frame.column !== void 0 ? `:${frame.column}` : ""}`).join("");
					return `#${entry.sequence} ${entry.level} ${entry.kind}${location} ${entry.text}${stack}`;
				}).join("\n") + (value.truncated ? `\n(output truncated; continue with since=${value.nextSince})` : "")
			}]
		},
		isConcurrencySafe: () => true,
		async execute(args, exec) {
			validateDebugArgs(args);
			const sessionId = registry.resolve(args.session, "browser_inspect(action=console)");
			const cmdArgs = [
				"console",
				"--session",
				sessionId
			];
			appendDebugOptions(cmdArgs, args);
			if (args.includeStack === true) cmdArgs.push("--include-stack");
			const reply = await runtime.run(exec, cmdArgs, "console", sessionId);
			return {
				session: sessionId,
				tabId: reply.tab_id,
				entries: (reply.entries ?? []).map((entry) => ({
					sequence: entry.sequence,
					kind: entry.kind,
					level: entry.level,
					text: entry.text,
					...entry.url !== void 0 ? { url: entry.url } : {},
					...entry.line !== void 0 ? { line: entry.line } : {},
					...entry.column !== void 0 ? { column: entry.column } : {},
					...entry.timestamp !== void 0 ? { timestamp: entry.timestamp } : {},
					stackTrace: (entry.stack_trace ?? []).map((frame) => ({
						...frame.function_name !== void 0 ? { functionName: frame.function_name } : {},
						...frame.url !== void 0 ? { url: frame.url } : {},
						...frame.line !== void 0 ? { line: frame.line } : {},
						...frame.column !== void 0 ? { column: frame.column } : {}
					})),
					truncated: entry.truncated ?? false
				})),
				nextSince: reply.next_since,
				truncated: reply.truncated ?? false
			};
		},
		presentCall: (args) => ({
			card: "terminal",
			title: runtime.commandLine([
				"console",
				"--session",
				args.session ?? "(current)"
			]),
			description: "Read browser console messages"
		}),
		presentResult: runtime.presentTerminalResult
	}));
	register(defineTool({
		name: "inspect.network",
		description: "Read buffered network responses and failures from a tab. Returns metadata only; request and response headers and bodies are not captured.",
		parameters: DEBUG_PARAMETERS,
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					session: {
						type: "string",
						required: true
					},
					tabId: {
						type: "integer",
						required: true
					},
					entries: {
						type: "array",
						required: true,
						items: {
							type: "object",
							additionalProperties: false,
							properties: {
								sequence: {
									type: "integer",
									required: true
								},
								kind: {
									type: "string",
									required: true,
									enum: ["response", "failure"]
								},
								method: { type: "string" },
								url: { type: "string" },
								status: { type: "integer" },
								statusText: { type: "string" },
								mimeType: { type: "string" },
								resourceType: { type: "string" },
								errorText: { type: "string" },
								timestamp: { type: "number" },
								truncated: {
									type: "boolean",
									required: true
								}
							}
						}
					},
					nextSince: {
						type: "integer",
						required: true
					},
					truncated: {
						type: "boolean",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: value.entries.length === 0 ? "(no network activity captured)" : value.entries.map((entry) => entry.kind === "failure" ? `#${entry.sequence} FAILED ${entry.method ?? "?"} ${entry.url ?? "(unknown)"} — ${entry.errorText ?? "failed"}` : `#${entry.sequence} ${entry.status ?? "?"} ${entry.method ?? "?"} ${entry.url ?? "(unknown)"}`).join("\n") + (value.truncated ? `\n(output truncated; continue with since=${value.nextSince})` : "")
			}]
		},
		isConcurrencySafe: () => true,
		async execute(args, exec) {
			validateDebugArgs(args);
			const sessionId = registry.resolve(args.session, "browser_inspect(action=network)");
			const cmdArgs = [
				"network",
				"--session",
				sessionId
			];
			appendDebugOptions(cmdArgs, args);
			const reply = await runtime.run(exec, cmdArgs, "network", sessionId);
			return {
				session: sessionId,
				tabId: reply.tab_id,
				entries: (reply.entries ?? []).map((entry) => ({
					sequence: entry.sequence,
					kind: entry.kind,
					...entry.method !== void 0 ? { method: entry.method } : {},
					...entry.url !== void 0 ? { url: entry.url } : {},
					...entry.status !== void 0 ? { status: entry.status } : {},
					...entry.status_text !== void 0 ? { statusText: entry.status_text } : {},
					...entry.mime_type !== void 0 ? { mimeType: entry.mime_type } : {},
					...entry.resource_type !== void 0 ? { resourceType: entry.resource_type } : {},
					...entry.error_text !== void 0 ? { errorText: entry.error_text } : {},
					...entry.timestamp !== void 0 ? { timestamp: entry.timestamp } : {},
					truncated: entry.truncated ?? false
				})),
				nextSince: reply.next_since,
				truncated: reply.truncated ?? false
			};
		},
		presentCall: (args) => ({
			card: "terminal",
			title: runtime.commandLine([
				"network",
				"--session",
				args.session ?? "(current)"
			]),
			description: "Read browser network activity"
		}),
		presentResult: runtime.presentTerminalResult
	}));
	register(defineTool({
		name: "assist.resize",
		description: "Resize the owned session's Agent Window using outer CSS-pixel dimensions.",
		parameters: {
			width: {
				type: "integer",
				required: true,
				description: "Agent Window outer width in CSS pixels (100..=7680)."
			},
			height: {
				type: "integer",
				required: true,
				description: "Agent Window outer height in CSS pixels (100..=7680)."
			},
			session: SESSION_PARAM
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					session: {
						type: "string",
						required: true
					},
					windowId: {
						type: "integer",
						required: true
					},
					width: {
						type: "integer",
						required: true
					},
					height: {
						type: "integer",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `[session ${value.session}] resized window ${value.windowId} to ${value.width}x${value.height}`
			}]
		},
		async execute(args, exec) {
			if (args.width < 100 || args.width > 7680 || args.height < 100 || args.height > 7680) throw new Error("width and height must each be in the range 100..=7680");
			const sessionId = registry.resolve(args.session, "browser_assist(action=resize)");
			const reply = await runtime.run(exec, [
				"window",
				"resize",
				"--session",
				sessionId,
				"--width",
				String(args.width),
				"--height",
				String(args.height)
			], "window resize", sessionId);
			return {
				session: sessionId,
				windowId: reply.window_id,
				width: reply.width,
				height: reply.height
			};
		},
		presentCall: (args) => ({
			card: "terminal",
			title: runtime.commandLine([
				"window",
				"resize",
				"--session",
				args.session ?? "(current)",
				"--width",
				String(args.width),
				"--height",
				String(args.height)
			]),
			description: "Resize the Agent Window"
		}),
		presentResult: runtime.presentTerminalResult
	}));
}
//#endregion
//#region src/phase-one-tools-tabs.ts
const TAB_ID_REQUIRED = {
	type: "integer",
	required: true,
	description: "Chrome tab id returned by browser_tabs list or create."
};
/** Add Agent Window tab management while preserving the owned-session boundary. */
function registerPhaseOneTabTools(deps, register, runtime) {
	const { registry } = deps;
	register(defineTool({
		name: "tabs.list",
		description: "List tabs visible to an owned browser session. Other sessions' Agent Windows remain hidden; use scope=user to find a user tab before borrowing it.",
		parameters: {
			session: SESSION_PARAM,
			scope: {
				type: "string",
				enum: [
					"user",
					"agent",
					"all"
				],
				description: "Which tabs to list (default: all)."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					session: {
						type: "string",
						required: true
					},
					tabs: {
						type: "array",
						required: true,
						items: {
							type: "object",
							additionalProperties: false,
							properties: {
								tabId: {
									type: "integer",
									required: true
								},
								title: { type: "string" },
								url: { type: "string" },
								windowId: { type: "integer" },
								active: { type: "boolean" },
								scope: {
									type: "string",
									enum: ["user", "agent"]
								}
							}
						}
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: value.tabs.length === 0 ? `[session ${value.session}] no matching tabs` : value.tabs.map((tab) => `${tab.tabId} [${tab.scope ?? "unknown"}]${tab.active === true ? " [active]" : ""} ${tab.title ?? "(untitled)"} — ${tab.url ?? "(unknown URL)"}`).join("\n")
			}]
		},
		isConcurrencySafe: () => true,
		async execute(args, exec) {
			const sessionId = registry.resolve(args.session, "browser_tabs(action=list)");
			const cmdArgs = [
				"tab",
				"list",
				"--session",
				sessionId
			];
			if (args.scope !== void 0) cmdArgs.push("--scope", args.scope);
			return {
				session: sessionId,
				tabs: (await runtime.run(exec, cmdArgs, "tab list", sessionId)).tabs.map((tab) => ({
					tabId: tab.tab_id,
					...tab.title !== void 0 ? { title: tab.title } : {},
					...tab.url !== void 0 ? { url: tab.url } : {},
					...tab.window_id !== void 0 ? { windowId: tab.window_id } : {},
					...tab.active !== void 0 ? { active: tab.active } : {},
					...tab.scope !== void 0 ? { scope: tab.scope } : {}
				}))
			};
		},
		presentCall: (args) => ({
			card: "terminal",
			title: runtime.commandLine([
				"tab",
				"list",
				"--session",
				args.session ?? "(current)",
				...args.scope !== void 0 ? ["--scope", args.scope] : []
			]),
			description: "List browser tabs"
		}),
		presentResult: runtime.presentTerminalResult
	}));
	register(defineTool({
		name: "tabs.create",
		description: "Create a tab inside the owned session's Agent Window. The tab is focused by default; set active=false to open it in the background.",
		parameters: {
			session: SESSION_PARAM,
			url: {
				type: "string",
				description: "Initial URL (default: chrome://newtab/)."
			},
			active: {
				type: "boolean",
				description: "Whether to focus the new tab (default: true)."
			},
			index: {
				type: "integer",
				description: "Insertion index in the Agent Window tab strip."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					session: {
						type: "string",
						required: true
					},
					tabId: {
						type: "integer",
						required: true
					},
					windowId: {
						type: "integer",
						required: true
					},
					url: {
						type: "string",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `[session ${value.session}] created tab ${value.tabId} in window ${value.windowId} (${value.url || "pending URL"})`
			}]
		},
		async execute(args, exec) {
			if (args.url !== void 0) requireNonEmpty(args.url, "url");
			const sessionId = registry.resolve(args.session, "browser_tabs(action=create)");
			const cmdArgs = [
				"tab",
				"create",
				"--session",
				sessionId
			];
			if (args.url !== void 0) cmdArgs.push("--url", args.url);
			if (args.active === false) cmdArgs.push("--no-active");
			if (args.index !== void 0) cmdArgs.push("--index", String(args.index));
			const reply = await runtime.run(exec, cmdArgs, "tab create", sessionId);
			if (args.active !== false && reply.url.length > 0) deps.observation.setUrl(sessionId, reply.url);
			return {
				session: sessionId,
				tabId: reply.tab_id,
				windowId: reply.window_id,
				url: reply.url
			};
		},
		presentCall: (args) => ({
			card: "terminal",
			title: runtime.commandLine([
				"tab",
				"create",
				"--session",
				args.session ?? "(current)",
				...args.url !== void 0 ? ["--url", args.url] : []
			]),
			description: "Create an Agent Window tab"
		}),
		presentResult: runtime.presentTerminalResult
	}));
	register(defineTool({
		name: "tabs.close",
		description: "Close a tab in the owned session's Agent Window.",
		parameters: {
			tabId: TAB_ID_REQUIRED,
			session: SESSION_PARAM
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					session: {
						type: "string",
						required: true
					},
					tabId: {
						type: "integer",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `[session ${value.session}] closed tab ${value.tabId}`
			}]
		},
		async execute(args, exec) {
			const sessionId = registry.resolve(args.session, "browser_tabs(action=close)");
			return {
				session: sessionId,
				tabId: (await runtime.run(exec, [
					"tab",
					"close",
					String(args.tabId),
					"--session",
					sessionId
				], "tab close", sessionId)).tab_id
			};
		},
		presentCall: (args) => ({
			card: "terminal",
			title: runtime.commandLine([
				"tab",
				"close",
				String(args.tabId),
				"--session",
				args.session ?? "(current)"
			]),
			description: "Close an Agent Window tab"
		}),
		presentResult: runtime.presentTerminalResult
	}));
	register(defineTool({
		name: "tabs.select",
		description: "Focus a tab in the owned session's Agent Window.",
		parameters: {
			tabId: TAB_ID_REQUIRED,
			session: SESSION_PARAM
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					session: {
						type: "string",
						required: true
					},
					tabId: {
						type: "integer",
						required: true
					},
					windowId: {
						type: "integer",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `[session ${value.session}] selected tab ${value.tabId} in window ${value.windowId}`
			}]
		},
		async execute(args, exec) {
			const sessionId = registry.resolve(args.session, "browser_tabs(action=select)");
			const reply = await runtime.run(exec, [
				"tab",
				"select",
				String(args.tabId),
				"--session",
				sessionId
			], "tab select", sessionId);
			return {
				session: sessionId,
				tabId: reply.tab_id,
				windowId: reply.window_id
			};
		},
		presentCall: (args) => ({
			card: "terminal",
			title: runtime.commandLine([
				"tab",
				"select",
				String(args.tabId),
				"--session",
				args.session ?? "(current)"
			]),
			description: "Select an Agent Window tab"
		}),
		presentResult: runtime.presentTerminalResult
	}));
	register(defineTool({
		name: "tabs.borrow",
		description: "Move a user-window tab into the owned session's Agent Window for controlled interaction. Return it with browser_tabs action=return; stopping the session also auto-returns it.",
		parameters: {
			tabId: TAB_ID_REQUIRED,
			session: SESSION_PARAM
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					session: {
						type: "string",
						required: true
					},
					tabId: {
						type: "integer",
						required: true
					},
					originalWindowId: {
						type: "integer",
						required: true
					},
					originalIndex: {
						type: "integer",
						required: true
					},
					agentWindowId: {
						type: "integer",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `[session ${value.session}] borrowed tab ${value.tabId} from window ${value.originalWindowId} into Agent Window ${value.agentWindowId}`
			}]
		},
		async execute(args, exec) {
			const sessionId = registry.resolve(args.session, "browser_tabs(action=borrow)");
			const reply = await runtime.run(exec, [
				"tab",
				"borrow",
				String(args.tabId),
				"--session",
				sessionId
			], "tab borrow", sessionId);
			return {
				session: sessionId,
				tabId: reply.tab_id,
				originalWindowId: reply.original_window_id,
				originalIndex: reply.original_index,
				agentWindowId: reply.agent_window_id
			};
		},
		presentCall: (args) => ({
			card: "terminal",
			title: runtime.commandLine([
				"tab",
				"borrow",
				String(args.tabId),
				"--session",
				args.session ?? "(current)"
			]),
			description: "Borrow a user tab"
		}),
		presentResult: runtime.presentTerminalResult
	}));
	register(defineTool({
		name: "tabs.return",
		description: "Return a borrowed tab to its original user window and tab-strip position.",
		parameters: {
			tabId: TAB_ID_REQUIRED,
			session: SESSION_PARAM
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					session: {
						type: "string",
						required: true
					},
					tabId: {
						type: "integer",
						required: true
					},
					returnedToWindowId: {
						type: "integer",
						required: true
					},
					returnedToIndex: {
						type: "integer",
						required: true
					},
					fallback: {
						type: "boolean",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `[session ${value.session}] returned tab ${value.tabId} to window ${value.returnedToWindowId} at index ${value.returnedToIndex}` + (value.fallback ? " (original window unavailable; used fallback)" : "")
			}]
		},
		async execute(args, exec) {
			const sessionId = registry.resolve(args.session, "browser_tabs(action=return)");
			const reply = await runtime.run(exec, [
				"tab",
				"return",
				String(args.tabId),
				"--session",
				sessionId
			], "tab return", sessionId);
			return {
				session: sessionId,
				tabId: reply.tab_id,
				returnedToWindowId: reply.returned_to_window_id,
				returnedToIndex: reply.returned_to_index,
				fallback: reply.fallback ?? false
			};
		},
		presentCall: (args) => ({
			card: "terminal",
			title: runtime.commandLine([
				"tab",
				"return",
				String(args.tabId),
				"--session",
				args.session ?? "(current)"
			]),
			description: "Return a borrowed tab"
		}),
		presentResult: runtime.presentTerminalResult
	}));
}
//#endregion
//#region src/phase-one-tools.ts
/** Register the first DSH capability-parity tranche on the existing runtime. */
function registerPhaseOneTools(deps, register, runtime) {
	registerPhaseOneInteractionTools(deps, register, runtime);
	registerPhaseOneTabTools(deps, register, runtime);
	registerPhaseOneNavigationTools(deps, register, runtime);
	registerPhaseOneSupportTools(deps, register, runtime);
}
//#endregion
//#region src/tools.ts
/**
* Internal browser operation definitions shared by the six model-facing tools.
* These definitions are never registered with `ctx.tools`: they provide the
* action-level validation, execution, rendering, and UI presentation reused by
* the domain tools without exposing one schema per operation to the model.
*/
/** Device presets supported by `bsk emulate --device`. */
const DEVICE_PRESETS$1 = [
	"iphone-14",
	"iphone-14-pro-max",
	"iphone-se",
	"pixel-7",
	"galaxy-s23",
	"ipad-mini",
	"galaxy-tab-s8"
];
/**
* Run one bsk command and return its parsed JSON payload, or throw.
* `observeSession` marks the run as model-facing work on that session: it is
* instrumented into the observation service (action begin/end) and tagged so
* interrupt() can kill exactly this child. Observation traffic itself never
* passes an observeSession.
*/
async function runBsk(deps, exec, args, label, observeSession, runnerTimeoutMs) {
	const releaseForeground = observeSession !== void 0 ? deps.observation.acquireForeground(observeSession) : void 0;
	let began = false;
	let actionError;
	try {
		let result;
		try {
			const runOnce = () => {
				if (observeSession !== void 0) {
					began = true;
					deps.observation.beginAction(observeSession, actionForLabel(label));
				}
				return runWithSessionBusyRetry(() => deps.runner.run(args, {
					signal: exec.signal,
					timeoutMs: runnerTimeoutMs ?? deps.config.defaultTimeoutMs,
					...observeSession !== void 0 ? { tag: observeSession } : {}
				}), exec.signal);
			};
			result = observeSession !== void 0 ? await deps.queue.run(observeSession, runOnce, exec.signal) : await runOnce();
		} catch (error) {
			if (isCommandNotFound(error)) throw new Error(bskInstallMessage(deps.config.bskPath));
			throw error;
		}
		if (result.aborted) {
			const error = /* @__PURE__ */ new Error("tool call aborted");
			error.name = "AbortError";
			throw error;
		}
		return parseBskJson(result, label);
	} catch (error) {
		actionError = error instanceof Error ? error.message.split("\n")[0] : String(error);
		throw error;
	} finally {
		if (observeSession !== void 0 && began) deps.observation.endAction(observeSession, actionError);
		releaseForeground?.();
	}
}
/** Build the command line shown on the pending terminal card (pure). */
function cmdline(deps, args) {
	return [deps.config.bskPath, ...args].join(" ");
}
/** Shared completed-card presenter: terminal card with the rendered text. */
function presentTerminalResult(_args, result) {
	const block = result.content.find((b) => b.type === "text");
	if (block === void 0 || block.type !== "text") return void 0;
	if (result.isError) return void 0;
	return {
		card: "terminal",
		output: block.text,
		exitCode: 0
	};
}
function abortError$1() {
	const error = /* @__PURE__ */ new Error("tool call aborted");
	error.name = "AbortError";
	return error;
}
/** Define the private action handlers through an injected collector. */
function defineBrowserOperations(deps, register) {
	const { registry } = deps;
	register(defineTool({
		name: "session.start",
		description: "Start a new browser session: opens an Agent Window in the connected browser and returns its session id. The new session becomes the current session for subsequent browser_* calls. Optionally navigate to an initial URL and/or apply a mobile device emulation preset.",
		parameters: {
			url: {
				type: "string",
				description: "Initial URL to navigate to after the session starts."
			},
			width: {
				type: "integer",
				description: "Agent Window outer width in CSS pixels (100..=7680). Requires height."
			},
			height: {
				type: "integer",
				description: "Agent Window outer height in CSS pixels (100..=7680). Requires width."
			},
			noFocus: {
				type: "boolean",
				description: "Open the Agent Window in the background without stealing focus."
			},
			browser: {
				type: "string",
				description: "Target browser instance id (only needed when multiple browsers are connected)."
			},
			device: {
				type: "string",
				enum: DEVICE_PRESETS$1,
				description: "Mobile device emulation preset applied to the tab after start."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					sessionId: {
						type: "string",
						required: true
					},
					browserInstanceId: {
						type: "string",
						required: true
					},
					url: { type: "string" },
					device: { type: "string" }
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `started browser session ${value.sessionId}` + (value.url !== void 0 ? ` and navigated to ${value.url}` : "") + (value.device !== void 0 ? ` (device: ${value.device})` : "")
			}]
		},
		async execute(args, exec) {
			if (args.url !== void 0 && args.url.trim().length === 0) throw new Error("url must be a non-empty string");
			if (args.width === void 0 !== (args.height === void 0)) throw new Error("width and height must be given together");
			registry.reserveStart();
			const startArgs = ["session", "start"];
			if (args.width !== void 0 && args.height !== void 0) startArgs.push("--width", String(args.width), "--height", String(args.height));
			if (args.noFocus === true) startArgs.push("--no-focus");
			if (args.browser !== void 0) startArgs.push("--browser", args.browser);
			let reply;
			try {
				reply = await runBsk(deps, exec, startArgs, "session start");
			} catch (error) {
				registry.abandonStart();
				throw error;
			}
			registry.completeStart({
				sessionId: reply.session_id,
				browserInstanceId: reply.browser_instance_id,
				startedAtMs: Date.now()
			});
			registry.trackOwner(reply.session_id, ownerSessionIds(deps.ctx, exec.agent?.id));
			deps.observation.addSession(reply.session_id, args.url);
			try {
				if (args.device !== void 0) await runBsk(deps, exec, [
					"emulate",
					"--session",
					reply.session_id,
					"--device",
					args.device
				], "emulate", reply.session_id);
				if (args.url !== void 0) await runBsk(deps, exec, [
					"navigate",
					"--session",
					reply.session_id,
					args.url
				], "navigate", reply.session_id);
			} catch (error) {
				try {
					await deps.observation.stopSession(reply.session_id);
				} catch {
					registry.remove(reply.session_id);
					deps.observation.removeSession(reply.session_id);
				}
				throw error;
			}
			return {
				sessionId: reply.session_id,
				browserInstanceId: reply.browser_instance_id,
				...args.url !== void 0 ? { url: args.url } : {},
				...args.device !== void 0 ? { device: args.device } : {}
			};
		},
		presentCall: (args) => ({
			card: "terminal",
			title: cmdline(deps, [
				"session",
				"start",
				...args.device !== void 0 ? ["+ emulate", args.device] : [],
				...args.url !== void 0 ? ["+ navigate", args.url] : []
			]),
			description: "Start a browser session"
		}),
		presentResult: presentTerminalResult
	}));
	register(defineTool({
		name: "session.stop",
		description: "Stop a browser session and close its Agent Window. Stops the given session, or the current session when `session` is omitted. Only plugin-created sessions can be stopped — sessions owned by other programs sharing the bsk daemon are refused.",
		parameters: { session: SESSION_PARAM },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: { stopped: {
					type: "string",
					required: true
				} }
			},
			render: (_args, value) => [{
				type: "text",
				text: `stopped browser session ${value.stopped}`
			}]
		},
		async execute(args, exec) {
			const sessionId = registry.resolveForStop(args.session);
			try {
				if (!await deps.observation.stopSession(sessionId, exec.signal)) throw new Error(`browser session ${sessionId} is not owned by this plugin`);
			} catch (error) {
				if (isCommandNotFound(error)) throw new Error(bskInstallMessage(deps.config.bskPath));
				throw error;
			}
			return { stopped: sessionId };
		},
		presentCall: (args) => ({
			card: "terminal",
			title: cmdline(deps, [
				"session",
				"stop",
				args.session ?? "(current session)"
			]),
			description: "Stop a browser session"
		}),
		presentResult: presentTerminalResult
	}));
	register(defineTool({
		name: "session.list",
		description: "List the browser sessions created by this plugin. Sessions owned by other programs on the shared bsk daemon are not visible here. The session marked `current` is the one browser_* tools act on when no explicit `session` is passed.",
		parameters: {},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: { sessions: {
					type: "array",
					required: true,
					items: {
						type: "object",
						additionalProperties: false,
						properties: {
							sessionId: {
								type: "string",
								required: true
							},
							browserInstanceId: {
								type: "string",
								required: true
							},
							current: {
								type: "boolean",
								required: true
							}
						}
					}
				} }
			},
			render: (_args, value) => [{
				type: "text",
				text: value.sessions.length === 0 ? "no active browser sessions" : value.sessions.map((s) => `${s.sessionId} (browser ${s.browserInstanceId})${s.current ? " [current]" : ""}`).join("\n")
			}]
		},
		isConcurrencySafe: () => true,
		async execute() {
			const current = registry.current();
			return { sessions: registry.list().map((entry) => ({
				sessionId: entry.sessionId,
				browserInstanceId: entry.browserInstanceId ?? "",
				current: entry.sessionId === current
			})) };
		},
		presentCall: () => ({
			card: "terminal",
			title: cmdline(deps, ["session", "list"]),
			description: "List browser sessions"
		}),
		presentResult: presentTerminalResult
	}));
	register(defineTool({
		name: "page.navigate",
		description: "Navigate the session's active tab to a URL and wait for a page lifecycle phase (default: load). Returns the final URL after redirects.",
		parameters: {
			url: {
				type: "string",
				required: true,
				description: "Destination URL."
			},
			session: SESSION_PARAM,
			waitUntil: {
				type: "string",
				enum: [
					"load",
					"domcontentloaded",
					"networkidle",
					"commit"
				],
				description: "Lifecycle phase to wait for (default: load)."
			},
			timeoutMs: {
				type: "integer",
				description: "Navigation wait timeout in milliseconds (default 30000)."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					session: {
						type: "string",
						required: true
					},
					tabId: {
						type: "integer",
						required: true
					},
					url: {
						type: "string",
						required: true
					},
					finalUrl: { type: "string" },
					reached: {
						type: "string",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `[session ${value.session}] navigated to ${value.finalUrl ?? value.url} (reached: ${value.reached})` + (value.reached === "timeout" ? " — the wait timed out before the requested phase" : "")
			}]
		},
		async execute(args, exec) {
			if (args.url.trim().length === 0) throw new Error("url must be a non-empty string");
			const sessionId = registry.resolve(args.session, "browser_page(action=navigate)");
			const cmdArgs = [
				"navigate",
				"--session",
				sessionId
			];
			if (args.waitUntil !== void 0) cmdArgs.push("--wait-until", args.waitUntil);
			if (args.timeoutMs !== void 0) cmdArgs.push("--timeout", `${args.timeoutMs}ms`);
			cmdArgs.push(args.url);
			const reply = await runBsk(deps, exec, cmdArgs, "navigate", sessionId);
			deps.observation.setUrl(sessionId, reply.final_url ?? reply.url);
			return {
				session: sessionId,
				tabId: reply.tab_id,
				url: reply.url,
				...reply.final_url !== void 0 ? { finalUrl: reply.final_url } : {},
				reached: reply.reached
			};
		},
		presentCall: (args) => ({
			card: "terminal",
			title: cmdline(deps, [
				"navigate",
				"--session",
				args.session ?? "(current)",
				args.url
			]),
			description: "Navigate to a URL"
		}),
		presentResult: presentTerminalResult
	}));
	const registerObservationTool = (kind) => {
		const isSnapshot = kind === "snapshot";
		const name = isSnapshot ? "inspect.snapshot" : "inspect.observe";
		register(defineTool({
			name,
			description: isSnapshot ? "Capture an indented aria-tree snapshot of the session's active tab. Interactive elements carry @eN refs for browser_interact actions. Prefer browser_inspect action=observe for a richer semantic view." : "Produce a semantic VOM observation of the session's active tab (roles, states, perception probes) with @eN refs for browser_interact actions. Read-only: never submits input.",
			parameters: {
				session: SESSION_PARAM,
				maxDepth: {
					type: "integer",
					description: "Cap on tree depth before truncating."
				},
				maxTokens: {
					type: "integer",
					description: "Soft cap on rendered tokens (~4 chars/token)."
				}
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						session: {
							type: "string",
							required: true
						},
						tabId: {
							type: "integer",
							required: true
						},
						text: {
							type: "string",
							required: true
						},
						refCount: {
							type: "integer",
							required: true
						},
						truncated: {
							type: "boolean",
							required: true
						}
					}
				},
				render: (_args, value) => [{
					type: "text",
					text: value.text.length > 0 ? value.text + (value.truncated ? "\n(truncated — re-run with looser caps)" : "") : "(empty observation — page may still be loading)"
				}]
			},
			isConcurrencySafe: () => true,
			async execute(args, exec) {
				const sessionId = registry.resolve(args.session, name);
				const cmdArgs = [
					kind,
					"--session",
					sessionId
				];
				if (args.maxDepth !== void 0) cmdArgs.push("--max-depth", String(args.maxDepth));
				if (args.maxTokens !== void 0) cmdArgs.push("--max-tokens", String(args.maxTokens));
				const reply = await runBsk(deps, exec, cmdArgs, kind, sessionId);
				return {
					session: sessionId,
					tabId: reply.tab_id,
					text: reply.text,
					refCount: reply.ref_count,
					truncated: reply.truncated ?? false
				};
			},
			presentCall: (args) => ({
				card: "terminal",
				title: cmdline(deps, [
					kind,
					"--session",
					args.session ?? "(current)"
				]),
				description: isSnapshot ? "Capture an aria snapshot" : "Observe the page semantically"
			}),
			presentResult: presentTerminalResult
		}));
	};
	registerObservationTool("snapshot");
	registerObservationTool("observe");
	register(defineTool({
		name: "interact.click",
		description: "Click an element in the session's active tab. Target is a snapshot ref (@e3) from the last browser_inspect observation, or a CSS selector.",
		parameters: {
			target: {
				type: "string",
				required: true,
				description: "Snapshot ref (@e3 / e3) or CSS selector of the element to click."
			},
			session: SESSION_PARAM,
			button: {
				type: "string",
				enum: [
					"left",
					"middle",
					"right"
				],
				description: "Mouse button (default: left)."
			},
			clickCount: {
				type: "integer",
				description: "Number of consecutive presses (double-click = 2)."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					session: {
						type: "string",
						required: true
					},
					tabId: {
						type: "integer",
						required: true
					},
					x: {
						type: "number",
						required: true
					},
					y: {
						type: "number",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `[session ${value.session}] clicked at (${value.x}, ${value.y}) on tab ${value.tabId}`
			}]
		},
		async execute(args, exec) {
			if (args.target.trim().length === 0) throw new Error("target must be a non-empty string");
			const sessionId = registry.resolve(args.session, "browser_interact(action=click)");
			const cmdArgs = [
				"click",
				"--session",
				sessionId
			];
			if (args.button !== void 0) cmdArgs.push("--button", args.button);
			if (args.clickCount !== void 0) cmdArgs.push("--click-count", String(args.clickCount));
			cmdArgs.push(args.target);
			const reply = await runBsk(deps, exec, cmdArgs, "click", sessionId);
			return {
				session: sessionId,
				tabId: reply.tab_id,
				x: reply.x,
				y: reply.y
			};
		},
		presentCall: (args) => ({
			card: "terminal",
			title: cmdline(deps, [
				"click",
				args.target,
				"--session",
				args.session ?? "(current)"
			]),
			description: "Click an element"
		}),
		presentResult: presentTerminalResult
	}));
	register(defineTool({
		name: "interact.fill",
		description: "Fill an input / textarea / contenteditable element, clearing it first by default. Target is a snapshot ref (@e3) or a CSS selector.",
		parameters: {
			target: {
				type: "string",
				required: true,
				description: "Snapshot ref (@e3 / e3) or CSS selector of the field."
			},
			value: {
				type: "string",
				required: true,
				description: "Text to type into the element."
			},
			session: SESSION_PARAM,
			noClear: {
				type: "boolean",
				description: "Skip the default wipe-the-field-first pass (append instead)."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					session: {
						type: "string",
						required: true
					},
					tabId: {
						type: "integer",
						required: true
					},
					valueLength: {
						type: "integer",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `[session ${value.session}] filled field on tab ${value.tabId} (${value.valueLength} chars)`
			}]
		},
		async execute(args, exec) {
			if (args.target.trim().length === 0) throw new Error("target must be a non-empty string");
			const sessionId = registry.resolve(args.session, "browser_interact(action=fill)");
			const cmdArgs = [
				"fill",
				"--session",
				sessionId,
				"--value",
				args.value
			];
			if (args.noClear === true) cmdArgs.push("--no-clear");
			cmdArgs.push(args.target);
			const reply = await runBsk(deps, exec, cmdArgs, "fill", sessionId);
			return {
				session: sessionId,
				tabId: reply.tab_id,
				valueLength: reply.value_length
			};
		},
		presentCall: (args) => ({
			card: "terminal",
			title: cmdline(deps, [
				"fill",
				args.target,
				"--session",
				args.session ?? "(current)"
			]),
			description: `Fill a field with ${args.value.length} chars`
		}),
		presentResult: presentTerminalResult
	}));
	register(defineTool({
		name: "interact.press",
		description: "Dispatch a keyboard key or combo (Enter, Escape, ArrowDown, Ctrl+A, …) to the session's active tab, optionally focusing a target element first.",
		parameters: {
			key: {
				type: "string",
				required: true,
				description: "Key spec: a CDP key name (Enter, a, ArrowLeft) or a combo (Ctrl+A)."
			},
			session: SESSION_PARAM,
			target: {
				type: "string",
				description: "Snapshot ref (@e3) or CSS selector to focus before pressing."
			},
			holdMs: {
				type: "integer",
				description: "Hold the key down for N milliseconds between keyDown and keyUp."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					session: {
						type: "string",
						required: true
					},
					tabId: {
						type: "integer",
						required: true
					},
					key: {
						type: "string",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `[session ${value.session}] pressed ${value.key} on tab ${value.tabId}`
			}]
		},
		async execute(args, exec) {
			if (args.key.trim().length === 0) throw new Error("key must be a non-empty string");
			const sessionId = registry.resolve(args.session, "browser_interact(action=press)");
			const cmdArgs = [
				"press",
				"--session",
				sessionId
			];
			if (args.target !== void 0) {
				if (args.target.trim().length === 0) throw new Error("target must be a non-empty string");
				if (/^@?e\d+$/.test(args.target)) cmdArgs.push("--ref", args.target);
				else cmdArgs.push("--selector", args.target);
			}
			if (args.holdMs !== void 0) cmdArgs.push("--hold-ms", String(args.holdMs));
			cmdArgs.push(args.key);
			const reply = await runBsk(deps, exec, cmdArgs, "press", sessionId);
			return {
				session: sessionId,
				tabId: reply.tab_id,
				key: reply.key
			};
		},
		presentCall: (args) => ({
			card: "terminal",
			title: cmdline(deps, [
				"press",
				args.key,
				"--session",
				args.session ?? "(current)"
			]),
			description: "Press a key"
		}),
		presentResult: presentTerminalResult
	}));
	register(defineTool({
		name: "inspect.screenshot",
		description: "Capture a PNG screenshot of the session's active tab, or crop to a snapshot ref element. Returns the image itself when the deployment supports image input, otherwise a file path.",
		parameters: {
			session: SESSION_PARAM,
			ref: {
				type: "string",
				description: "Snapshot ref (@e3) from the last snapshot/observe; crops to that element."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					session: {
						type: "string",
						required: true
					},
					tabId: {
						type: "integer",
						required: true
					},
					path: {
						type: "string",
						required: true
					},
					width: {
						type: "integer",
						required: true
					},
					height: {
						type: "integer",
						required: true
					},
					byteSize: {
						type: "integer",
						required: true
					},
					image: {
						type: "object",
						additionalProperties: false,
						properties: {
							attachmentId: {
								type: "string",
								required: true
							},
							mediaType: {
								type: "string",
								required: true,
								enum: [
									"image/png",
									"image/jpeg",
									"image/webp",
									"image/gif"
								]
							},
							bytes: {
								type: "integer",
								required: true
							},
							width: {
								type: "integer",
								required: true
							},
							height: {
								type: "integer",
								required: true
							},
							name: { type: "string" }
						}
					}
				}
			},
			render: (_args, value) => {
				const blocks = [{
					type: "text",
					text: value.image !== void 0 ? `[session ${value.session}] screenshot of tab ${value.tabId} (${value.width}x${value.height}px)` : `[session ${value.session}] screenshot saved to ${value.path} (${value.width}x${value.height}px, ${value.byteSize} bytes) — this deployment cannot inline images; read the file to view it`
				}];
				if (value.image !== void 0) blocks.push({
					type: "image",
					attachment: {
						attachmentId: value.image.attachmentId,
						mediaType: value.image.mediaType,
						bytes: value.image.bytes,
						width: value.image.width,
						height: value.image.height,
						...value.image.name !== void 0 ? { name: value.image.name } : {}
					}
				});
				return blocks;
			}
		},
		isConcurrencySafe: () => true,
		async execute(args, exec) {
			const sessionId = registry.resolve(args.session, "browser_inspect(action=screenshot)");
			const outPath = join(tmpdir(), `bsk-screenshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`);
			const cmdArgs = [
				"screenshot",
				"--session",
				sessionId,
				"--out",
				outPath
			];
			if (args.ref !== void 0) cmdArgs.push("--ref", args.ref);
			let keepFile = false;
			let writtenPath;
			try {
				const reply = await runBsk(deps, exec, cmdArgs, "screenshot", sessionId);
				writtenPath = reply.path;
				const data = await readFile(reply.path);
				if (exec.signal.aborted) throw abortError$1();
				const ref = await trySaveScreenshot(deps.ctx, exec, data, `screenshot-${sessionId}.png`);
				keepFile = ref === void 0;
				return {
					session: sessionId,
					tabId: reply.tab_id,
					path: reply.path,
					width: reply.width,
					height: reply.height,
					byteSize: reply.byte_size,
					...ref !== void 0 ? { image: {
						attachmentId: String(ref.attachmentId),
						mediaType: ref.mediaType,
						bytes: ref.bytes,
						width: ref.width,
						height: ref.height,
						...ref.name !== void 0 ? { name: ref.name } : {}
					} } : {}
				};
			} finally {
				if (!keepFile) await unlink(writtenPath ?? outPath).catch(() => {});
			}
		},
		presentCall: (args) => ({
			card: "terminal",
			title: cmdline(deps, [
				"screenshot",
				"--session",
				args.session ?? "(current)",
				...args.ref !== void 0 ? ["--ref", args.ref] : []
			]),
			description: "Capture a screenshot"
		}),
		presentResult: presentTerminalResult
	}));
	register(defineTool({
		name: "assist.emulate",
		description: "Apply (or clear) mobile device emulation on the session's active tab: viewport metrics, user agent, and touch. Overrides are per-tab and not inherited by new tabs.",
		parameters: {
			session: SESSION_PARAM,
			device: {
				type: "string",
				enum: DEVICE_PRESETS$1,
				description: "Built-in device preset."
			},
			width: {
				type: "integer",
				description: "Viewport width in CSS pixels (requires height)."
			},
			height: {
				type: "integer",
				description: "Viewport height in CSS pixels (requires width)."
			},
			mobile: {
				type: "boolean",
				description: "Emulate a mobile viewport. Requires width+height — the bsk daemon refuses --mobile without viewport dimensions, so this flag cannot be used alone."
			},
			off: {
				type: "boolean",
				description: "Clear every emulation override on the tab."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					session: {
						type: "string",
						required: true
					},
					tabId: {
						type: "integer",
						required: true
					},
					cleared: {
						type: "boolean",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: value.cleared ? `[session ${value.session}] cleared emulation on tab ${value.tabId}` : `[session ${value.session}] applied emulation on tab ${value.tabId}`
			}]
		},
		async execute(args, exec) {
			const sessionId = registry.resolve(args.session, "browser_assist(action=emulate)");
			if (args.off === true) {
				if (args.device !== void 0 || args.width !== void 0 || args.height !== void 0) throw new Error("off is mutually exclusive with device/width/height");
			} else if (args.device === void 0 && args.width === void 0) throw new Error("nothing to apply: pass device or width+height (mobile also requires width+height), or off");
			if (args.width === void 0 !== (args.height === void 0)) throw new Error("width and height must be given together");
			const cmdArgs = [
				"emulate",
				"--session",
				sessionId
			];
			if (args.off === true) cmdArgs.push("--off");
			else {
				if (args.device !== void 0) cmdArgs.push("--device", args.device);
				if (args.width !== void 0 && args.height !== void 0) cmdArgs.push("--width", String(args.width), "--height", String(args.height));
				if (args.mobile === true) cmdArgs.push("--mobile");
			}
			const reply = await runBsk(deps, exec, cmdArgs, "emulate", sessionId);
			return {
				session: sessionId,
				tabId: reply.tab_id,
				cleared: reply.cleared
			};
		},
		presentCall: (args) => ({
			card: "terminal",
			title: cmdline(deps, [
				"emulate",
				"--session",
				args.session ?? "(current)",
				...args.off === true ? ["--off"] : [],
				...args.device !== void 0 ? ["--device", args.device] : []
			]),
			description: "Emulate a device environment"
		}),
		presentResult: presentTerminalResult
	}));
	registerPhaseOneTools(deps, register, {
		run: (exec, args, label, observeSession, runnerTimeoutMs) => runBsk(deps, exec, args, label, observeSession, runnerTimeoutMs),
		commandLine: (args) => cmdline(deps, args),
		presentTerminalResult
	});
}
/**
* Build the private action handlers without publishing them to the model. The
* six browser tools dispatch through these handlers, preserving validation,
* rendering, cancellation, ownership, UI presentation, and attachments.
*/
function createBrowserOperationDefinitions(deps) {
	const definitions = [];
	defineBrowserOperations(deps, (definition) => {
		definitions.push(definition);
	});
	return definitions;
}
//#endregion
//#region src/browser-tools.ts
/**
* The six model-facing BrowserSkill tools. Each action dispatches to a private
* operation handler, so the model receives only six schemas while every action
* retains the existing ownership, cancellation, queuing, observation,
* screenshot, and presentation behavior.
*/
const DEVICE_PRESETS = [
	"iphone-14",
	"iphone-14-pro-max",
	"iphone-se",
	"pixel-7",
	"galaxy-s23",
	"ipad-mini",
	"galaxy-tab-s8"
];
const TARGET_PARAM = {
	type: "string",
	description: "Snapshot ref such as @e3, or a CSS selector."
};
const DOMAIN_RESULT = { type: "json" };
function operationArgs(args) {
	const { action: _action, ...rest } = args;
	return rest;
}
function definitionFor(definitions, actions, action) {
	const operationName = typeof action === "string" ? actions[action] : void 0;
	const definition = operationName === void 0 ? void 0 : definitions.get(operationName);
	if (definition === void 0) throw new Error(`unsupported browser action: ${String(action)}`);
	return definition;
}
function defineBrowserTool(spec, definitions) {
	const actionNames = Object.keys(spec.actions);
	return defineTool({
		name: spec.name,
		description: spec.description,
		parameters: {
			action: {
				type: "string",
				required: true,
				enum: actionNames,
				description: "Operation to perform. Other arguments are action-dependent and are validated by that operation."
			},
			...spec.parameters
		},
		output: {
			schema: DOMAIN_RESULT,
			render(args, value) {
				return definitionFor(definitions, spec.actions, args.action).output.render(operationArgs(args), value);
			}
		},
		isConcurrencySafe(args) {
			return definitionFor(definitions, spec.actions, args.action).isConcurrencySafe?.(operationArgs(args)) === true;
		},
		async execute(args, exec) {
			return await definitionFor(definitions, spec.actions, args.action).execute(operationArgs(args), exec);
		},
		presentCall(args) {
			return definitionFor(definitions, spec.actions, args.action).presentCall?.(operationArgs(args));
		},
		presentResult(args, result) {
			return definitionFor(definitions, spec.actions, args.action).presentResult?.(operationArgs(args), result);
		}
	});
}
const BROWSER_TOOL_SPECS = [
	{
		name: "browser_session",
		description: "Manage plugin-owned browser sessions. Actions: start opens an Agent Window; stop closes an owned session; list returns owned sessions. For start, url/device/width/height/noFocus/browser are optional. For stop, session is optional and defaults to the current owned session.",
		actions: {
			start: "session.start",
			stop: "session.stop",
			list: "session.list"
		},
		parameters: {
			session: SESSION_PARAM,
			url: {
				type: "string",
				description: "Initial URL for start."
			},
			width: {
				type: "integer",
				description: "Agent Window width; start requires height too."
			},
			height: {
				type: "integer",
				description: "Agent Window height; start requires width too."
			},
			noFocus: {
				type: "boolean",
				description: "Start the Agent Window in the background."
			},
			browser: {
				type: "string",
				description: "Browser instance id for start."
			},
			device: {
				type: "string",
				enum: DEVICE_PRESETS,
				description: "Device preset for start."
			}
		}
	},
	{
		name: "browser_page",
		description: "Navigate and wait on the active Agent Window tab. Actions: navigate, back, forward, reload, wait. navigate requires url; reload optionally accepts hard; navigation actions accept waitUntil/timeoutMs. Observe again after a meaningful page change before reusing refs.",
		actions: {
			navigate: "page.navigate",
			back: "page.back",
			forward: "page.forward",
			reload: "page.reload",
			wait: "page.wait"
		},
		parameters: {
			session: SESSION_PARAM,
			tabId: TAB_ID_PARAM,
			url: {
				type: "string",
				description: "Destination URL; required for navigate."
			},
			waitUntil: WAIT_UNTIL_PARAM,
			timeoutMs: TIMEOUT_MS_PARAM,
			hard: {
				type: "boolean",
				description: "Bypass cache for reload."
			}
		}
	},
	{
		name: "browser_inspect",
		description: "Read page state without arbitrary script execution. Actions: observe, snapshot, html, screenshot, console, network. Prefer observe, then snapshot, then bounded html; use screenshot for visual evidence. console/network support cursor fields since/limit/maxTextChars.",
		actions: {
			observe: "inspect.observe",
			snapshot: "inspect.snapshot",
			html: "inspect.html",
			screenshot: "inspect.screenshot",
			console: "inspect.console",
			network: "inspect.network"
		},
		parameters: {
			session: SESSION_PARAM,
			tabId: TAB_ID_PARAM,
			maxDepth: {
				type: "integer",
				description: "Tree depth cap for observe/snapshot."
			},
			maxTokens: {
				type: "integer",
				description: "Token cap for observe/snapshot."
			},
			ref: {
				type: "string",
				description: "Fresh ref for scoped html or cropped screenshot."
			},
			maxBytes: {
				type: "integer",
				description: "HTML byte cap."
			},
			since: {
				type: "integer",
				description: "Console/network sequence cursor."
			},
			limit: {
				type: "integer",
				description: "Console/network entry cap."
			},
			maxTextChars: {
				type: "integer",
				description: "Console/network per-entry text cap."
			},
			includeStack: {
				type: "boolean",
				description: "Include console stack frames."
			}
		}
	},
	{
		name: "browser_interact",
		description: "Interact with an element in the active Agent Window tab. Actions: click, hover, fill, select, press. click/hover/fill/select require target; fill also requires value; select requires values; press requires key and may optionally focus target first.",
		actions: {
			click: "interact.click",
			hover: "interact.hover",
			fill: "interact.fill",
			select: "interact.select",
			press: "interact.press"
		},
		parameters: {
			session: SESSION_PARAM,
			tabId: TAB_ID_PARAM,
			target: TARGET_PARAM,
			button: {
				type: "string",
				enum: [
					"left",
					"middle",
					"right"
				],
				description: "Click button."
			},
			clickCount: {
				type: "integer",
				description: "Click count."
			},
			value: {
				type: "string",
				description: "Text for fill."
			},
			noClear: {
				type: "boolean",
				description: "Append instead of clearing for fill."
			},
			modifiers: {
				type: "array",
				items: {
					type: "string",
					enum: [
						"alt",
						"ctrl",
						"meta",
						"shift"
					]
				},
				description: "Modifiers held during hover."
			},
			settleMs: {
				type: "integer",
				description: "Hover settle delay."
			},
			timeoutMs: TIMEOUT_MS_PARAM,
			values: {
				type: "array",
				items: { type: "string" },
				description: "Option values for select; at least one is required."
			},
			key: {
				type: "string",
				description: "Key or combo for press."
			},
			holdMs: {
				type: "integer",
				description: "Key hold duration for press."
			}
		}
	},
	{
		name: "browser_tabs",
		description: "Manage tabs visible to an owned session. Actions: list, create, select, close, borrow, return. select/close/borrow/return require tabId from list/create. Borrow moves a user tab into the Agent Window; return it as soon as the task finishes.",
		actions: {
			list: "tabs.list",
			create: "tabs.create",
			select: "tabs.select",
			close: "tabs.close",
			borrow: "tabs.borrow",
			return: "tabs.return"
		},
		parameters: {
			session: SESSION_PARAM,
			tabId: TAB_ID_PARAM,
			scope: {
				type: "string",
				enum: [
					"user",
					"agent",
					"all"
				],
				description: "Tab scope for list."
			},
			url: {
				type: "string",
				description: "Initial URL for create."
			},
			active: {
				type: "boolean",
				description: "Focus the created tab (default true)."
			},
			index: {
				type: "integer",
				description: "Insertion index for create."
			}
		}
	},
	{
		name: "browser_assist",
		description: "Display and human-assistance operations. Actions: resize, emulate, request-help. resize requires width/height; emulate accepts device or width/height/mobile, or off alone; request-help requires prompt and can wait for explicit completion criteria.",
		actions: {
			resize: "assist.resize",
			emulate: "assist.emulate",
			"request-help": "assist.request-help"
		},
		parameters: {
			session: SESSION_PARAM,
			tabId: TAB_ID_PARAM,
			width: {
				type: "integer",
				description: "Window/viewport width."
			},
			height: {
				type: "integer",
				description: "Window/viewport height."
			},
			device: {
				type: "string",
				enum: DEVICE_PRESETS,
				description: "Emulation device preset."
			},
			mobile: {
				type: "boolean",
				description: "Enable a mobile viewport with width/height."
			},
			off: {
				type: "boolean",
				description: "Clear emulation; use alone."
			},
			prompt: {
				type: "string",
				description: "Instructions shown to the user for request-help."
			},
			title: {
				type: "string",
				description: "Optional request-help title."
			},
			targets: {
				type: "array",
				items: { type: "string" },
				description: "Refs/selectors highlighted for request-help."
			},
			timeoutMs: TIMEOUT_MS_PARAM,
			completionCriteria: {
				type: "object",
				additionalProperties: false,
				description: "Automatic completion detector for request-help.",
				properties: {
					any: {
						type: "array",
						items: {
							type: "object",
							additionalProperties: false,
							properties: {
								urlContains: { type: "string" },
								urlMatches: { type: "string" },
								selectorExists: { type: "string" },
								selectorMissing: { type: "string" },
								textExists: { type: "string" },
								textMissing: { type: "string" }
							}
						}
					},
					all: {
						type: "array",
						items: {
							type: "object",
							additionalProperties: false,
							properties: {
								urlContains: { type: "string" },
								urlMatches: { type: "string" },
								selectorExists: { type: "string" },
								selectorMissing: { type: "string" },
								textExists: { type: "string" },
								textMissing: { type: "string" }
							}
						}
					},
					stableForMs: { type: "integer" }
				}
			}
		}
	}
];
function indexOperations(definitions) {
	const indexed = /* @__PURE__ */ new Map();
	for (const definition of definitions) {
		if (indexed.has(definition.name)) throw new Error(`duplicate browser operation definition: ${definition.name}`);
		indexed.set(definition.name, definition);
	}
	const routed = new Set(BROWSER_TOOL_SPECS.flatMap((spec) => Object.values(spec.actions)));
	const missing = [...routed].filter((name) => !indexed.has(name));
	const unreachable = [...indexed.keys()].filter((name) => !routed.has(name));
	if (missing.length > 0 || unreachable.length > 0) throw new Error([missing.length > 0 ? `missing operations: ${missing.join(", ")}` : void 0, unreachable.length > 0 ? `unreachable operations: ${unreachable.join(", ")}` : void 0].filter(Boolean).join("; "));
	return indexed;
}
/** Register the complete six-tool browser suite; returns its combined disposer. */
function registerBrowserTools(deps) {
	const definitions = indexOperations(createBrowserOperationDefinitions(deps));
	const disposers = BROWSER_TOOL_SPECS.map((spec) => deps.ctx.tools.register(defineBrowserTool(spec, definitions))).filter((dispose) => typeof dispose === "function");
	return () => {
		for (const dispose of disposers.splice(0)) dispose();
	};
}
//#endregion
//#region src/skill-content.generated.ts
const BSK_SKILL_NAME = "browser-skill";
const BSK_SKILL_DESCRIPTION = "Browser automation against the user's logged-in Chromium through this plugin's injected browser_* tools. Use to visit and read pages, fill forms, click through flows, inspect tabs, debug page activity, or smoke-test UI changes in a managed Agent Window.";
const BSK_SKILL_MARKDOWN = "# browser-skill for DeepSeek Harness\n\nDrive the user's logged-in Chromium through this plugin's structured browser tools. Automation is\nisolated in an Agent Window; user-window tabs remain protected unless explicitly borrowed.\n\nLoading this skill reveals six tools for the rest of the conversation:\n\n- `browser_session` owns session lifecycle.\n- `browser_page` handles navigation and lifecycle waits.\n- `browser_inspect` reads semantic, visual, console, and network state.\n- `browser_interact` performs normal page interactions.\n- `browser_tabs` manages Agent Window tabs and temporary user-tab borrowing.\n- `browser_assist` handles human help, window size, and device emulation.\n\nEvery call includes an `action`. Treat each loaded tool schema as authoritative for its actions and\nparameters; do not guess fields. All browser work must use the injected tools directly so session\nownership, cancellation, attachments, observation UI, and cleanup remain intact. Do not invoke\nanother process to control the browser.\n\n## Mandatory workflow\n\nEvery task owns a bounded plugin session:\n\n```text\nbrowser_session({ action: \"start\", ... })\n... use the returned sessionId for browser work ...\nbrowser_session({ action: \"stop\", session: sessionId })\n```\n\nPass the session explicitly when more than one exists. Never guess or reuse an id owned by another\nprogram. Stop in a finally-style path on success and failure unless the user explicitly asks to keep\nthe session open. Stopping also returns borrowed tabs.\n\n## Work toward one observable goal\n\n- Derive a concrete success condition from the user's request.\n- Take the shortest purposeful path: observe, act, then make at most one observation to confirm an\n  ambiguous result.\n- Once success is visible, do not click, refresh, navigate, switch tabs, or perform extra checks.\n- If a human-only step appears or two attempts make no progress, request help instead of\n  brute-forcing.\n\n## Observe, act, observe\n\nUse `browser_inspect` action `observe` as the primary semantic page view. It returns roles, states,\ntext, and `@eN` refs. Prefer fresh refs over raw selectors. Refs invalidate after navigation and may\nalso become stale after large DOM changes, so observe again before the next interaction.\n\nUse `browser_interact` for click, hover, fill, select, and key actions. An observation marks a\nhover-only surface as `@e1 button \"Products\" [hover first: Shoes | Bags]`. The listed items are\nlabels, not usable refs: hover the trigger, observe again, then act on the revealed item's own ref.\nDo not click the trigger itself unless the user wants the trigger's action.\n\nEscalate reading only as needed:\n\n1. `observe` for normal understanding and interaction refs.\n2. `snapshot` when a stricter static accessibility tree is more useful.\n3. `html` for exact markup or hidden metadata that semantic views cannot provide.\n4. `screenshot` for layout, styling, canvas, images, or requested visual evidence.\n\nDo not start with raw HTML or screenshots merely to discover ordinary controls. When interaction is\nneeded, obtain a fresh observation before acting on screenshot or HTML findings.\n\nUse `browser_page` for purposeful navigation, history, reload, or a lifecycle wait. Avoid speculative\nwaits when no navigation is expected. After any page change, discard old refs and observe again.\n\n## Respect the Agent Window boundary\n\nUse `browser_tabs` to list returned tab ids before selecting, closing, borrowing, or returning tabs.\nBorrow a user tab only for the immediate task, and return it as soon as that step is complete. Never\ninvent a tab id or keep a personal tab borrowed across unrelated work.\n\n## Ask the human when needed\n\nUse `browser_assist` action `request-help` for login, captcha, OTP, payment confirmation, consent, or\nanother step the user must complete. Give a precise prompt and highlight fresh targets when concrete\ncontrols are involved. Use completion criteria only for a clear stable success signal.\n\nResume only after the user continues or the criteria complete. Treat cancellation as rejection and\ntimeout as a blocker rather than retrying. Observe again after control returns before reasoning about\nthe new state or using refs.\n\nThe same tool can resize the Agent Window or emulate a device when the task requires visual or\nresponsive testing. Emulation is scoped to one tab.\n\n## Debug and recover without wandering\n\nUse `browser_inspect` console or network actions only for relevant, bounded, read-only diagnostics.\nContinue from returned sequence cursors instead of rereading the same buffer.\n\n- Stale ref: observe again and retry the intended action once.\n- Unknown tab: list tabs instead of guessing.\n- Unknown session: list owned sessions or start one; never try foreign ids.\n- Timeout: inspect current state before deciding whether one longer purposeful wait is useful.\n- Unrecoverable failure: report the blocker and stop the owned session.\n\nArbitrary page-script evaluation and interaction recording are intentionally unsupported. Do not\ninvent tools or route around those limits.\n";
//#endregion
//#region src/lazy-tools.ts
/** Parse a tool arguments payload that may be normalized (object) or raw JSON. */
function skillNameOf(args) {
	if (typeof args === "string") try {
		return skillNameOf(JSON.parse(args));
	} catch {
		return;
	}
	if (typeof args === "object" && args !== null && "name" in args) {
		const name = args.name;
		return typeof name === "string" ? name : void 0;
	}
}
function isSkillInvocationMessage(data) {
	if (typeof data !== "object" || data === null) return false;
	const source = data.source;
	if (typeof source !== "object" || source === null) return false;
	const { kind, name } = source;
	return kind === "skill-invocation" && name === "browser-skill";
}
/**
* A durable log proves the skill was successfully invoked when a successful
* `tool/result` pairs a `tool/call` for skill/browser-skill — or when a
* `/browser-skill` user gesture landed as a skill-invocation message.
*/
function hasSuccessfulSkillInvocation(events) {
	const skillCallIds = /* @__PURE__ */ new Set();
	for (const event of events) {
		if (event.type !== "tool/call") continue;
		const data = event.data;
		if (data?.name === "skill" && skillNameOf(data.arguments) === "browser-skill") skillCallIds.add(data.callId);
	}
	for (const event of events) {
		if (event.type === "tool/result") {
			const message = event.data?.message;
			if (typeof message !== "object" || message === null) continue;
			const { callId, isError } = message;
			if (isError === false && skillCallIds.has(callId)) return true;
		}
		if (isSkillInvocationMessage(event.data)) return true;
	}
	return false;
}
/**
* Arm the lazy reveal. Returns a disposer tearing down listeners and — when
* the reveal already happened — the tool suite itself.
* @param registerSuite - registers the six browser tools and returns their disposer.
*/
function armLazyTools(ctx, registerSuite) {
	let suiteDisposer;
	const disposers = [];
	const ensureSuite = () => {
		if (suiteDisposer !== void 0) return;
		try {
			suiteDisposer = registerSuite();
		} catch (error) {
			suiteDisposer = void 0;
			console.warn(`[dsh-plugin-browserskill] lazy tool registration failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	};
	const onToolResult = (exec, result) => {
		if (result.isError) return;
		if (exec.name !== "skill") return;
		if (skillNameOf(exec.arguments) === "browser-skill") ensureSuite();
	};
	disposers.push(ctx.on("tools/result", onToolResult));
	const scanSession = (session) => {
		try {
			if (hasSuccessfulSkillInvocation(session.events)) ensureSuite();
		} catch {}
	};
	const onSessionEvent = (_session, event) => {
		if (isSkillInvocationMessage(event?.data)) ensureSuite();
	};
	disposers.push(ctx.on("session/event", onSessionEvent));
	const onSessionCreated = (session) => scanSession(session);
	disposers.push(ctx.on("session/created", onSessionCreated));
	const sessions = ctx.get("sessions");
	if (sessions != null && typeof sessions.list === "function") for (const session of sessions.list()) scanSession(session);
	return () => {
		for (const dispose of disposers.splice(0)) dispose();
		suiteDisposer?.();
	};
}
//#endregion
//#region src/observation-http.ts
const ROUTE_BASE = "/bsk-observation";
const SSE_HEARTBEAT_MS = 15e3;
function sendJson(res, status, body) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(body));
}
/**
* Browser-trust fence, mirroring the one dsh applies to its /api routes (ours
* live outside that prefix, so the checks are replicated here):
* - Host must be a loopback authority (localhost / 127.0.0.0/8 / [::1]) — the
*   observation channel exposes live screenshots and must never answer a LAN
*   or DNS-rebound name;
* - a present Origin must be same-host with the Host header (blocks cross-site
*   reads), and `sec-fetch-site: cross-site` is refused outright;
* - POST must be `application/json` — anything a cross-site *simple request*
*   can send (form/plain) never reaches the handler, which kills CSRF.
*/
function fenceViolation(req) {
	const host = req.headers.host ?? "";
	const hostname = /^\[.*\](?::\d+)?$/.test(host) ? host.slice(1, host.indexOf("]")) : host.split(":")[0];
	if (!(hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "::1" || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname))) return "host is not a loopback authority";
	const origin = req.headers.origin;
	if (origin !== void 0 && origin !== "null") {
		let originHost;
		try {
			originHost = new URL(origin).host;
		} catch {
			return "unparseable Origin header";
		}
		if (originHost !== host) return "Origin does not match Host";
	}
	if (req.headers["sec-fetch-site"] === "cross-site") return "sec-fetch-site: cross-site";
	if (req.method === "POST") {
		const contentType = req.headers["content-type"] ?? "";
		if (!/^\s*application\/json\s*(;|$)/.test(contentType)) return "POST requires an application/json body";
	}
}
/** Run the fence; returns true when the request was rejected (handled). */
function fenceRejected(req, res) {
	const violation = fenceViolation(req);
	if (violation === void 0) return false;
	sendJson(res, 403, { error: `forbidden: ${violation}` });
	return true;
}
/**
* Register the observation routes. No-op (with a console note) when the
* composition has no web server.
* @returns disposer removing the routes.
*/
function registerObservationRoutes(ctx, observation) {
	const webServer = ctx.get("webServer");
	if (webServer === void 0) return () => {};
	const disposers = [
		webServer.register({
			kind: "exact",
			path: `${ROUTE_BASE}/state`,
			handler: (req, res) => {
				if (req.method !== "GET") {
					sendJson(res, 405, { error: "method not allowed" });
					return;
				}
				if (fenceRejected(req, res)) return;
				sendJson(res, 200, {
					sessions: observation.getState(),
					available: observation.isAvailable()
				});
			}
		}),
		webServer.register({
			kind: "exact",
			path: `${ROUTE_BASE}/events`,
			handler: (req, res) => {
				if (req.method !== "GET") {
					sendJson(res, 405, { error: "method not allowed" });
					return;
				}
				if (fenceRejected(req, res)) return;
				res.writeHead(200, {
					"content-type": "text/event-stream",
					"cache-control": "no-cache",
					connection: "keep-alive"
				});
				const unsubscribe = observation.subscribe((event) => {
					res.write(`data: ${JSON.stringify(event)}\n\n`);
				});
				const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), SSE_HEARTBEAT_MS);
				res.on("close", () => {
					clearInterval(heartbeat);
					unsubscribe();
				});
			}
		}),
		webServer.register({
			kind: "exact",
			path: `${ROUTE_BASE}/interrupt`,
			handler: (req, res) => {
				if (req.method !== "POST") {
					sendJson(res, 405, { error: "method not allowed" });
					return;
				}
				if (fenceRejected(req, res)) return;
				let body = "";
				req.on("data", (chunk) => {
					body += chunk;
				});
				req.on("end", () => {
					let sessionId;
					try {
						const parsed = JSON.parse(body || "{}");
						if (typeof parsed.sessionId === "string" && parsed.sessionId !== "") sessionId = parsed.sessionId;
					} catch {
						sendJson(res, 400, { error: "invalid JSON body" });
						return;
					}
					sendJson(res, 200, { interrupted: observation.interrupt(sessionId) });
				});
			}
		}),
		webServer.register({
			kind: "exact",
			path: `${ROUTE_BASE}/stop`,
			handler: (req, res) => {
				if (req.method !== "POST") {
					sendJson(res, 405, { error: "method not allowed" });
					return;
				}
				if (fenceRejected(req, res)) return;
				let body = "";
				req.on("data", (chunk) => {
					body += chunk;
				});
				req.on("end", () => {
					let sessionId;
					try {
						const parsed = JSON.parse(body || "{}");
						if (typeof parsed.sessionId === "string" && parsed.sessionId !== "") sessionId = parsed.sessionId;
					} catch {
						sendJson(res, 400, { error: "invalid JSON body" });
						return;
					}
					if (sessionId === void 0) {
						sendJson(res, 400, { error: "sessionId required" });
						return;
					}
					observation.stopSession(sessionId).then((stopped) => sendJson(res, 200, { stopped }), () => sendJson(res, 500, { error: "stop failed" }));
				});
			}
		}),
		webServer.register({
			kind: "prefix",
			path: `${ROUTE_BASE}/thumbnail`,
			handler: async (req, res) => {
				if (req.method !== "GET") {
					sendJson(res, 405, { error: "method not allowed" });
					return;
				}
				if (fenceRejected(req, res)) return;
				const attachmentId = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname).slice(`${ROUTE_BASE}/thumbnail/`.length);
				const frame = await observation.readThumbnail(attachmentId);
				if (frame === void 0) {
					sendJson(res, 404, { error: "unknown thumbnail" });
					return;
				}
				res.writeHead(200, {
					"content-type": frame.mediaType,
					"cache-control": "no-cache"
				});
				res.end(Buffer.from(frame.data));
			}
		})
	];
	return () => {
		for (const dispose of disposers) dispose();
	};
}
//#endregion
//#region src/queue.ts
/**
* Per-key FIFO executor. The bsk daemon serializes commands per session (a
* second command while one is unfinished is rejected), so every plugin
* command — model-facing tool calls AND observation captures — funnels
* through one queue per session. A queued task rejects early if its abort
* signal fires before it starts; once running, cancellation is owned by the
* task's own signal handling (the runner kills the child).
*/
var KeyedExecutor = class {
	tails = /* @__PURE__ */ new Map();
	/** Run `fn` after every previously queued task for `key` settled. */
	run(key, fn, signal) {
		const previous = this.tails.get(key) ?? Promise.resolve();
		const task = new Promise((resolve, reject) => {
			let settled = false;
			const onAbort = () => {
				if (!settled) {
					settled = true;
					reject(abortError());
				}
			};
			signal?.addEventListener("abort", onAbort, { once: true });
			previous.then(() => {
				if (settled) return;
				if (signal?.aborted) {
					settled = true;
					reject(abortError());
					return;
				}
				signal?.removeEventListener("abort", onAbort);
				fn().then((value) => {
					settled = true;
					resolve(value);
				}, (error) => {
					settled = true;
					reject(error);
				});
			});
		});
		const tail = Promise.allSettled([previous, task]).then(() => {});
		this.tails.set(key, tail);
		tail.then(() => {
			if (this.tails.get(key) === tail) this.tails.delete(key);
		});
		return task;
	}
};
function abortError() {
	const error = /* @__PURE__ */ new Error("tool call aborted");
	error.name = "AbortError";
	return error;
}
//#endregion
//#region src/sessions.ts
var SessionRegistry = class {
	maxSessions;
	sessions = /* @__PURE__ */ new Map();
	currentId;
	/**
	* bsk session id → the DSH session ids that may clean it up: the agent
	* session that started it plus every ancestor along the seed lineage, so
	* archiving a conversation at ANY level of the chain reaps its browsers
	* (see archive-cleanup.ts).
	*/
	dshOwners = /* @__PURE__ */ new Map();
	/**
	* Slots reserved by in-flight starts. reserveStart/completeStart/abandonStart
	* run synchronously around the async spawn, so concurrent starts can never
	* both pass the capacity check (check-and-reserve is atomic on the event loop).
	*/
	pendingStarts = 0;
	constructor(maxSessions) {
		this.maxSessions = maxSessions;
	}
	/**
	* Reserve a start slot synchronously, BEFORE spawning.
	* @throws when the configured concurrency cap (tracked + in-flight) is reached.
	*/
	reserveStart() {
		if (this.sessions.size + this.pendingStarts >= this.maxSessions) throw new Error(`session limit reached (${this.maxSessions} concurrent sessions); stop one with browser_session action=stop before starting another`);
		this.pendingStarts += 1;
	}
	/** Give back a reservation after a start that never produced a session. */
	abandonStart() {
		this.pendingStarts = Math.max(0, this.pendingStarts - 1);
	}
	/**
	* Register a freshly started session, consuming its reservation, and make
	* it current.
	*/
	completeStart(session) {
		this.pendingStarts = Math.max(0, this.pendingStarts - 1);
		if (!this.sessions.has(session.sessionId) && this.sessions.size >= this.maxSessions) throw new Error(`session limit reached (${this.maxSessions} concurrent sessions); stop one with browser_session action=stop before starting another`);
		this.sessions.set(session.sessionId, {
			...session,
			owned: true
		});
		this.currentId = session.sessionId;
	}
	/** Forget a session; falls back to the most recent remaining one. */
	remove(sessionId) {
		this.sessions.delete(sessionId);
		this.dshOwners.delete(sessionId);
		if (this.currentId === sessionId) {
			const rest = [...this.sessions.values()];
			this.currentId = rest.length > 0 ? rest[rest.length - 1].sessionId : void 0;
		}
	}
	/**
	* Record which DSH conversation(s) a freshly started bsk session belongs
	* to (the starting agent's session plus its ancestors). No-op without ids
	* — e.g. a start whose caller carried no agent identity.
	*/
	trackOwner(sessionId, dshSessionIds) {
		if (dshSessionIds.length === 0 || !this.sessions.has(sessionId)) return;
		this.dshOwners.set(sessionId, new Set(dshSessionIds));
	}
	/** bsk session ids owned by the given DSH conversation (or its descendants). */
	ownedByDsh(dshSessionId) {
		const owned = [];
		for (const [sessionId, owners] of this.dshOwners) if (owners.has(dshSessionId)) owned.push(sessionId);
		return owned;
	}
	/** The DSH conversation ids owning one bsk session (empty when untracked). */
	dshOwnersOf(sessionId) {
		return [...this.dshOwners.get(sessionId) ?? []];
	}
	/** Mark an owned session as most recently used (recency order refresh). */
	touch(sessionId) {
		const existing = this.sessions.get(sessionId);
		if (existing === void 0) return;
		this.sessions.delete(sessionId);
		this.sessions.set(sessionId, existing);
		this.currentId = sessionId;
	}
	/** The current session id, if any. */
	current() {
		return this.currentId;
	}
	/** Owned sessions in least- to most-recently-used order. */
	list() {
		return [...this.sessions.values()];
	}
	/** Ids of owned sessions — the exact set unload cleanup is allowed to stop. */
	ownedIds() {
		return this.list().filter((session) => session.owned).map((session) => session.sessionId);
	}
	/** Whether the session was created by this plugin. */
	isOwned(sessionId) {
		return this.sessions.get(sessionId)?.owned === true;
	}
	size() {
		return this.sessions.size;
	}
	/** Shared not-yours error for foreign or unknown session ids. */
	foreignError(sessionId, toolName) {
		return /* @__PURE__ */ new Error(`${toolName}: session "${sessionId}" does not belong to this plugin — only sessions created by browser_session action=start are visible and operable here`);
	}
	/**
	* Resolve the session a tool call acts on: an explicit `session` argument
	* must name an owned session (and becomes current); omitted falls back to
	* the current session. Foreign ids are rejected, never adopted.
	* @throws on foreign/unknown ids, or when no session exists.
	*/
	resolve(explicit, toolName) {
		if (explicit !== void 0 && explicit.trim().length > 0) {
			if (!this.isOwned(explicit)) throw this.foreignError(explicit, toolName);
			this.touch(explicit);
			return explicit;
		}
		const current = this.current();
		if (current === void 0) throw new Error(`${toolName} needs a session but none is active — use browser_session action=start`);
		this.touch(current);
		return current;
	}
	/**
	* Resolve the session a STOP call acts on. Same ownership rule as every
	* other tool; a rejected stop never moves the current pointer.
	*/
	resolveForStop(explicit) {
		const candidate = explicit !== void 0 && explicit.trim().length > 0 ? explicit : this.current();
		if (candidate === void 0) throw new Error("browser_session action=stop needs a session but none is active — use action=start first");
		if (!this.isOwned(candidate)) throw this.foreignError(candidate, "browser_session(action=stop)");
		return candidate;
	}
};
//#endregion
//#region src/skill.ts
/**
* Publish the browser skill as an embedded runtime skill. Returns the unregistration
* disposer. A composition without the `skills` service (or with dsh-tool-skill
* retired) leaves the rest of the plugin unaffected — the no-op is silent.
*/
function registerBskSkill(ctx) {
	const skills = ctx.get("skills");
	if (skills == null || typeof skills.register !== "function") return () => {};
	return skills.register({
		name: BSK_SKILL_NAME,
		description: BSK_SKILL_DESCRIPTION,
		content: BSK_SKILL_MARKDOWN,
		source: "bundled"
	});
}
/**
* Install the DSH-specific browser skill into every exact agent scope.
*
* DSH merges skill layers nearest-first (`agent -> preset -> global`). A legacy
* CLI skill installed at `~/.agents/skills/browser-skill` is discovered by the
* preset filesystem provider and therefore shadows a plugin-level registration.
* Registering the embedded skill through `agent.ctx` makes the DSH protocol
* contract authoritative for that agent without touching the shared CLI skill.
*
* New agents are handled at `agent/session-start`, the first supported startup
* injection point and still before the first prompt assembly. Existing agents
* are registered immediately so plugin reloads take effect without recreating
* the conversation. Returns a disposer for all plugin-owned registrations.
*/
function armAgentScopedBskSkill(ctx) {
	const registrations = /* @__PURE__ */ new Map();
	let active = true;
	const registerForAgent = (agent) => {
		if (!active || registrations.has(agent)) return;
		registrations.set(agent, registerBskSkill(agent.ctx));
	};
	let stopSessionStart = () => {};
	let stopDisposed = () => {};
	if (typeof ctx.on === "function") {
		stopSessionStart = ctx.on("agent/session-start", ({ agent }) => {
			registerForAgent(agent);
		});
		stopDisposed = ctx.on("agent/disposed", ({ agent }) => {
			registrations.delete(agent);
		});
	}
	const agents = ctx.get("agents");
	if (agents != null && typeof agents.list === "function") for (const agent of agents.list()) registerForAgent(agent);
	return () => {
		if (!active) return;
		active = false;
		stopDisposed();
		stopSessionStart();
		for (const unregister of [...registrations.values()].reverse()) unregister();
		registrations.clear();
	};
}
//#endregion
//#region src/index.ts
const name = "@wxg-prc-cpg/browser-skill-dsh-plugin";
const inject = ["tools"];
/** Runtime configuration schema (validated and defaulted by Cordis). */
const Config = Schema.object({
	bskPath: Schema.string().default("bsk").description("Path to the bsk CLI binary (defaults to resolving `bsk` from PATH)."),
	defaultTimeoutMs: Schema.number().default(12e4).description("Default per-command timeout in milliseconds."),
	maxSessions: Schema.number().default(5).description("Maximum number of concurrent browser sessions started through this plugin."),
	observationEnabled: Schema.boolean().default(true).description("Track per-session observation state (action/url/thumbnail) for the PiP overlay."),
	thumbnailIntervalMs: Schema.number().default(1500).description("Thumbnail refresh cadence for active sessions (milliseconds)."),
	idleIntervalMs: Schema.number().default(8e3).description("Thumbnail refresh cadence for idle sessions; also the recent-activity window."),
	lazyTools: Schema.boolean().default(true).description("Reveal the browser_* tools only after the browser-skill skill is invoked (default true); false registers the full suite at load.")
});
function apply(ctx, config = {}, options = {}) {
	const resolved = {
		bskPath: config.bskPath ?? "bsk",
		defaultTimeoutMs: config.defaultTimeoutMs ?? 12e4,
		maxSessions: config.maxSessions ?? 5,
		observationEnabled: config.observationEnabled ?? true,
		thumbnailIntervalMs: config.thumbnailIntervalMs ?? 1500,
		idleIntervalMs: config.idleIntervalMs ?? 8e3,
		lazyTools: config.lazyTools ?? true
	};
	const runner = options.runnerFactory?.(resolved.bskPath) ?? createBskRunner(resolved.bskPath);
	const registry = new SessionRegistry(resolved.maxSessions);
	const queue = new KeyedExecutor();
	const observation = new ObservationService({
		ctx,
		runner,
		registry,
		queue,
		options: {
			enabled: resolved.observationEnabled,
			thumbnailIntervalMs: resolved.thumbnailIntervalMs,
			idleIntervalMs: resolved.idleIntervalMs
		}
	});
	const unregisterSkill = registerBskSkill(ctx);
	const disarmAgentSkill = armAgentScopedBskSkill(ctx);
	const registerSuite = () => registerBrowserTools({
		ctx,
		runner,
		registry,
		config: resolved,
		observation,
		queue
	});
	const removeSuite = resolved.lazyTools ? armLazyTools(ctx, registerSuite) : registerSuite();
	let removeRoutes = () => {};
	ctx.inject(["webServer"], (injected) => {
		removeRoutes = registerObservationRoutes(injected, observation);
		return () => removeRoutes();
	});
	const disarmArchiveCleanup = armArchiveCleanup(ctx, registry, observation);
	runner.run(["--version"], { timeoutMs: 1e4 }).then(() => {}, (error) => {
		const detail = error instanceof Error ? error.message : String(error);
		console.warn(`[${name}] bsk probe failed (${detail}); browser tools will report install guidance until the bsk CLI is available`);
	});
	ctx.effect(() => {
		return () => {
			removeSuite();
			disarmAgentSkill();
			unregisterSkill();
			removeRoutes();
			disarmArchiveCleanup();
			runner.killAll();
			const stops = registry.ownedIds().map((sessionId) => observation.stopSession(sessionId).catch(() => false));
			return Promise.all(stops).then(() => observation.dispose());
		};
	});
}
//#endregion
export { BskError, Config, KeyedExecutor, ObservationService, SessionRegistry, apply, armArchiveCleanup, createBskRunner, inject, name, ownerSessionIds, registerBrowserTools, registerObservationRoutes };
