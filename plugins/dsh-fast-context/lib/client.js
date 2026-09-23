/**
 * fast-context — Client half.
 *
 * One surface: `conversation.input.dock`, a card above the composer that shows
 * the pre-send retrieval the Host half runs when a session opens.
 *
 *   ⬤  Explore   Fast Context retrieval   Running        0:05   [ Open › ]
 *      Agent  Fast Context retrieval  ·  Model  this session's model
 *      Pre-Send
 *
 * It reads run state from the **subagent catalog that already exists** — the same
 * `subagentsByParent` projection the shipped subagent header uses — so the card
 * needs no transport of its own. The one thing it must do is open the catalog for
 * its session: the client only keeps a parent's catalog live while somebody is
 * observing it, and on a blank session nobody else is.
 *
 * Every string goes through `locale.bind(NS)`. Like the other Muen plugins this
 * one carries all seven languages itself rather than waiting on the language
 * pack: `en` and `zh` are the harness's built-in ids, and `ko`/`ja`/`fr`/`de`/`es`
 * are registered with the same single-locale `register(ns, locale, dict)` form the
 * packs use. A deployment without those languages never selects them, so the
 * extra dictionaries are inert rather than broken.
 */

window.__ModuleLoader__.load({
  id: '@muen/dsh-fast-context',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'fast-context';

    /** Must match LABEL in the Host half: it is how the card finds its run. */
    const LABEL = 'Fast Context retrieval';

    /** How long the "ready" state stays on screen before the card retires. */
    const READY_LINGER_MS = 8000;

    /** A running child is re-polled at this interval, in case the catalog lags. */
    const POLL_MS = 2500;

    const EN = {
      explore: 'Explore',
      title: 'Fast Context retrieval',
      running: 'Running',
      ready: 'Ready in {seconds}s',
      agent: 'Agent',
      model: 'Model',
      phase: 'Pre-Send',
      open: 'Open',
      openTitle: 'Open the retrieval agent’s own conversation',
      inherited: 'this session’s model',
    };

    const ZH = {
      explore: '探索',
      title: '快速上下文检索',
      running: '运行中',
      ready: '{seconds} 秒完成',
      agent: '智能体',
      model: '模型',
      phase: '发送前',
      open: '打开',
      openTitle: '打开检索智能体的独立会话',
      inherited: '当前会话的模型',
    };

    const KO = {
      explore: '탐색',
      title: '빠른 컨텍스트 검색',
      running: '실행 중',
      ready: '{seconds}초 만에 준비됨',
      agent: '에이전트',
      model: '모델',
      phase: '전송 전',
      open: '열기',
      openTitle: '검색 에이전트의 대화를 엽니다',
      inherited: '이 세션의 모델',
    };

    const JA = {
      explore: '探索',
      title: '高速コンテキスト取得',
      running: '実行中',
      ready: '{seconds} 秒で完了',
      agent: 'エージェント',
      model: 'モデル',
      phase: '送信前',
      open: '開く',
      openTitle: '検索エージェントの会話を開きます',
      inherited: 'このセッションのモデル',
    };

    const FR = {
      explore: 'Explorer',
      title: 'Récupération rapide du contexte',
      running: 'En cours',
      ready: 'Prêt en {seconds} s',
      agent: 'Agent',
      model: 'Modèle',
      phase: 'Avant envoi',
      open: 'Ouvrir',
      openTitle: 'Ouvrir la conversation de l’agent d’exploration',
      inherited: 'le modèle de cette session',
    };

    const DE = {
      explore: 'Erkunden',
      title: 'Schnelle Kontextabfrage',
      running: 'Läuft',
      ready: 'Bereit in {seconds} s',
      agent: 'Agent',
      model: 'Modell',
      phase: 'Vor dem Senden',
      open: 'Öffnen',
      openTitle: 'Die Unterhaltung des Suchagenten öffnen',
      inherited: 'das Modell dieser Sitzung',
    };

    const ES = {
      explore: 'Explorar',
      title: 'Recuperación rápida de contexto',
      running: 'En curso',
      ready: 'Listo en {seconds} s',
      agent: 'Agente',
      model: 'Modelo',
      phase: 'Antes de enviar',
      open: 'Abrir',
      openTitle: 'Abrir la conversación del agente de exploración',
      inherited: 'el modelo de esta sesión',
    };

    /** Replace {name} placeholders. An unknown key falls through to the key itself. */
    function interpolate(template, params) {
      if (params === undefined || params === null) return template;
      return String(template).replace(/\{(\w+)\}/g, function (whole, name) {
        return Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole;
      });
    }

    /** Replaced in apply() once the locale service is bound. */
    let translate = function (key, params) {
      const template = EN[key];
      if (template === undefined) return key;
      return interpolate(template, params);
    };

    /** `0:05`, `1:12` — minutes and zero-padded seconds. */
    function clock(ms) {
      const total = Math.max(0, Math.floor(ms / 1000));
      const minutes = Math.floor(total / 60);
      const seconds = total % 60;
      return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
    }

    const styles = {
      card: {
        boxSizing: 'border-box',
        width: 'calc(100% - 2 * var(--dsh-composer-side-clearance, 0px))',
        maxWidth: 'var(--dsh-composer-card-max-width, none)',
        margin: '0 auto 8px',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 12,
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        padding: '10px 14px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        overflow: 'hidden',
        position: 'relative',
      },
      row: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
      badge: {
        flex: 'none',
        width: 28,
        height: 28,
        borderRadius: '50%',
        color: 'var(--dsw-alias-brand-primary)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--dsw-alias-interactive-bg-hover)',
      },
      tag: {
        flex: 'none',
        color: 'var(--dsw-alias-state-success-primary)',
        fontSize: 13,
        lineHeight: '18px',
        fontWeight: 500,
      },
      title: {
        minWidth: 0,
        flex: '0 1 auto',
        fontSize: 14,
        lineHeight: '20px',
        fontWeight: 600,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      status: { flex: 'none', fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-brand-primary)' },
      statusReady: { flex: 'none', fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-state-success-primary)' },
      spacer: { flex: 1, minWidth: 8 },
      elapsed: {
        flex: 'none',
        fontVariantNumeric: 'tabular-nums',
        fontSize: 12,
        lineHeight: '18px',
        color: 'var(--dsw-alias-label-primary)',
      },
      action: {
        flex: 'none',
        border: 0,
        background: 'transparent',
        color: 'var(--dsw-alias-brand-primary)',
        font: 'inherit',
        fontSize: 13,
        lineHeight: '18px',
        padding: '2px 4px',
        borderRadius: 6,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
      },
      meta: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
        flexWrap: 'wrap',
        fontSize: 12,
        lineHeight: '18px',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      metaKey: { color: 'var(--dsw-alias-label-caption)' },
      metaValue: { color: 'var(--dsw-alias-label-secondary)' },
      dot: { color: 'var(--dsw-alias-label-caption)' },
      phase: { fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-brand-primary)' },
      track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: 'var(--dsw-alias-border-l1)' },
      fill: { height: '100%', width: '100%', background: 'var(--dsw-alias-state-business-primary)' },
    };

    const KEYFRAMES = '@keyframes dsh-fast-context-sweep{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}';

    /** The mark: a magnifier drawn inline, so nothing has to resolve for the card to render. */
    function Badge() {
      return h(
        'span',
        { style: styles.badge, 'aria-hidden': 'true' },
        h(
          'svg',
          { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
          h('circle', { cx: 11, cy: 11, r: 7 }),
          h('path', { d: 'm20 20-3.5-3.5' }),
        ),
      );
    }

    /** The moving underline. Decorative only. */
    function Track() {
      return h(
        'div',
        { style: styles.track, 'aria-hidden': 'true' },
        h('div', {
          style: Object.assign({}, styles.fill, {
            animation: 'dsh-fast-context-sweep 1.4s ease-in-out infinite',
            transform: 'translateX(-100%)',
          }),
        }),
      );
    }

    /**
     * The card.
     *
     * Renders null unless a run for this session is in the catalog. That is the
     * whole silence rule: no child, no card — a deployment without the Host half,
     * a failed start, or a session that already has a user turn all render
     * nothing rather than a spinner that never resolves.
     *
     * `props.inject` hands over a fresh object on every render, so the callbacks
     * are captured once into a ref. Depending on them directly would re-run the
     * observe effect on every render — and the refresh it triggers re-renders.
     */
    function FastContextCard(props) {
      const apiRef = React.useRef(null);
      if (apiRef.current === null && typeof props.observe === 'function') {
        apiRef.current = {
          observe: props.observe,
          refresh: typeof props.refresh === 'function' ? props.refresh : null,
          openChild: typeof props.openChild === 'function' ? props.openChild : null,
        };
      }

      const sessionId = props.sessionId === undefined || props.sessionId === null ? null : String(props.sessionId);
      const useSessions = props.useSessions;

      const catalogs = typeof useSessions === 'function'
        ? useSessions((state) => (state === undefined ? undefined : state.subagentsByParent))
        : undefined;
      const summaries = typeof useSessions === 'function'
        ? useSessions((state) => (state === undefined ? undefined : state.byId))
        : undefined;

      // Keep this session's catalog live while the card is mounted, and pull once
      // more shortly after in case the child was published after the first pull.
      React.useEffect(
        function () {
          const api = apiRef.current;
          if (sessionId === null || api === null) return undefined;
          api.observe(sessionId, true);
          const late = window.setTimeout(function () {
            if (api.refresh !== null) api.refresh(sessionId);
          }, 900);
          return function () {
            window.clearTimeout(late);
            api.observe(sessionId, false);
          };
        },
        [sessionId],
      );

      const catalog = sessionId === null || catalogs === undefined || catalogs === null ? undefined : catalogs[sessionId];
      const entries = catalog !== undefined && catalog !== null && Array.isArray(catalog.entries) ? catalog.entries : [];
      let child = null;
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (entry !== null && entry !== undefined && entry.kind === 'child' && entry.label === LABEL) {
          child = entry;
          break;
        }
      }

      const childId = child === null ? null : String(child.id);
      const running = child !== null && child.activity === 'running';

      const summary = sessionId === null || summaries === undefined || summaries === null ? undefined : summaries[sessionId];
      // A session with a user turn behind it no longer needs this card.
      const blank = summary === undefined || summary === null ? true : summary.blank !== false;

      const clockState = React.useState(function () {
        return Date.now();
      });
      const now = clockState[0];
      const setNow = clockState[1];

      // The clock starts when this child first appears and is never reset, so the
      // readout freezes at the run's real duration instead of dropping to 0:00.
      const startedRef = React.useRef(null);
      React.useEffect(
        function () {
          startedRef.current = childId === null ? null : Date.now();
        },
        [childId],
      );

      React.useEffect(
        function () {
          if (!running) return undefined;
          const handle = window.setInterval(function () {
            setNow(Date.now());
          }, 1000);
          return function () {
            window.clearInterval(handle);
          };
        },
        [childId, running],
      );

      // While a child runs, nudge the catalog in case its live feed misses the
      // transition. The poll stops the moment the child is done.
      React.useEffect(
        function () {
          const api = apiRef.current;
          if (!running || sessionId === null || api === null || api.refresh === null) return undefined;
          const handle = window.setInterval(function () {
            api.refresh(sessionId);
          }, POLL_MS);
          return function () {
            window.clearInterval(handle);
          };
        },
        [childId, running, sessionId],
      );

      const hiddenState = React.useState(false);
      const hidden = hiddenState[0];
      const setHidden = hiddenState[1];
      React.useEffect(
        function () {
          if (running) {
            setHidden(false);
            return undefined;
          }
          const handle = window.setTimeout(function () {
            setHidden(true);
          }, READY_LINGER_MS);
          return function () {
            window.clearTimeout(handle);
          };
        },
        [childId, running],
      );

      if (child === null || hidden || !blank) return null;

      const elapsed = startedRef.current === null ? 0 : now - startedRef.current;
      const elapsedSeconds = Math.max(0, Math.round(elapsed / 1000));

      // The run's own conversation is a child session; open it the way the
      // shipped subagent catalog does.
      const api = apiRef.current;
      const onOpen = function () {
        if (api === null || api.openChild === null) return;
        try {
          api.openChild({ parentSessionId: sessionId, childSessionId: childId, mode: child.mode });
        } catch (error) {
          // Opening is a convenience; never let it break the composer.
        }
      };
      const canOpen = api !== null && api.openChild !== null;

      return h(
        'div',
        { style: styles.card, 'data-fast-context': running ? 'running' : 'ready' },
        h('style', null, KEYFRAMES),
        h(
          'div',
          { style: styles.row },
          h(Badge, null),
          h('span', { style: styles.tag }, translate('explore')),
          h('span', { style: styles.title, title: translate('title') }, translate('title')),
          running
            ? h('span', { style: styles.status }, translate('running'))
            : h('span', { style: styles.statusReady }, translate('ready', { seconds: elapsedSeconds })),
          h('span', { style: styles.spacer }),
          h('span', { style: styles.elapsed }, clock(elapsed)),
          canOpen
            ? h(
              'button',
              { type: 'button', style: styles.action, onClick: onOpen, title: translate('openTitle') },
              translate('open'),
              h(
                'svg',
                { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
                h('path', { d: 'm9 18 6-6-6-6' }),
              ),
            )
            : null,
        ),
        h(
          'div',
          { style: styles.meta },
          h('span', { style: styles.metaKey }, translate('agent')),
          h('span', { style: styles.metaValue }, LABEL),
          h('span', { style: styles.dot }, '·'),
          h('span', { style: styles.metaKey }, translate('model')),
          h('span', { style: styles.metaValue }, translate('inherited')),
        ),
        h('div', { style: styles.phase }, translate('phase')),
        running ? h(Track, null) : null,
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        // Dictionaries are resources this plugin owns, so they ride ctx.effect. A
        // duplicate (ns, locale) throws — which a hot reload can race — and a lost
        // dictionary must not take the card down with it.
        ctx.effect(() => {
          const disposers = [];
          const pairs = [['en', EN], ['zh', ZH], ['ko', KO], ['ja', JA], ['fr', FR], ['de', DE], ['es', ES]];
          for (let i = 0; i < pairs.length; i++) {
            try {
              disposers.push(ctx.locale.register(NS, pairs[i][0], pairs[i][1]));
            } catch (error) {
              // already registered by an earlier generation of this plugin
            }
          }
          return function () {
            for (let i = 0; i < disposers.length; i++) {
              try {
                disposers[i]();
              } catch (error) {
                // disposal is best-effort
              }
            }
          };
        }, 'fast-context: dictionaries');
        translate = ctx.locale.bind(NS);

        // Both services are optional: without them the card renders nothing rather
        // than failing to mount.
        let sessions = null;
        ctx.inject(['sessions'], (scope) => {
          scope.effect(() => {
            sessions = scope.sessions;
            return function () {
              sessions = null;
            };
          }, 'fast-context: sessions service');
        });

        let workspace = null;
        ctx.inject(['uiWorkspace'], (scope) => {
          scope.effect(() => {
            workspace = scope.uiWorkspace;
            return function () {
              workspace = null;
            };
          }, 'fast-context: workspace service');
        });

        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register(
          {
            name: 'conversation.input.dock',
            id: 'fast-context',
            order: 40,
            inject: () => ({
              observe: (parentSessionId, open) => {
                if (sessions === null || typeof sessions.setSubagentCatalogOpen !== 'function') return;
                try {
                  sessions.setSubagentCatalogOpen(parentSessionId, open);
                } catch (error) {
                  // a catalog that will not open only costs the card its data
                }
              },
              refresh: (parentSessionId) => {
                if (sessions === null || typeof sessions.refreshSubagents !== 'function') return;
                try {
                  sessions.refreshSubagents(parentSessionId);
                } catch (error) {
                  // ditto
                }
              },
              openChild: (address) => {
                if (workspace === null || typeof workspace.openSession !== 'function') return;
                workspace.openSession(address);
              },
            }),
          },
          FastContextCard,
        ));
      },
    };
  },
});
