// @muen/dsh-composer-race — host half.
//
// The whole plugin is a browser-side concern: one hidden marker inside the composer
// card and one injected stylesheet. The host registers nothing — no HTTP routes, no
// settings namespace, no store — so this half exists only because a Cordis bundle
// row is a plugin with both faces available.
//
// Deliberately empty of state: the busy fact it renders is the session's own
// `running`, owned by the harness. A second owner would create two sources of truth
// for one state, and the marker is derived, not stored.
const name = 'composer-race'
const inject = []

function apply() {}

export { apply, inject, name }
