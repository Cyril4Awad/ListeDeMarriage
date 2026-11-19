import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchWeddingList, signOut } from '../api';
import { Flourish, Seal } from './Ornaments';
import './ListeDeMariage.css';

/* ---------------------------------------------------------------
   Data comes from GET /api/wedding:
   couple: { name, remark, accountEnding }
   gifts:  [{ id, location, receiptNo, from, message, date (yyyy-mm-dd), amount, currency }]
---------------------------------------------------------------- */

const formatters = {};
const moneyIn = (currency) => {
    if (!formatters[currency]) {
        try {
            formatters[currency] = new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 });
        } catch (e) {
            // Not an ISO code: show the number and the code as they are.
            const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
            formatters[currency] = { format: (n) => `${plain.format(n)} ${currency}` };
        }
    }
    return formatters[currency];
};

/* Sums per currency, e.g. [{ currency: 'USD', sum: 1200 }], largest first. */
const totalsOf = (list) => {
    const by = {};
    list.forEach((g) => { by[g.currency] = (by[g.currency] || 0) + g.amount; });
    return Object.entries(by).map(([currency, sum]) => ({ currency, sum })).sort((a, b) => b.sum - a.sum);
};
const formatTotals = (totals) =>
    totals.length ? totals.map((t) => moneyIn(t.currency).format(t.sum)).join(' + ') : moneyIn('USD').format(0);

const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric' });
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short' });
const shortFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' });
const longFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const plainFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

/* The list refreshes itself this often while the page is open and visible. */
const REFRESH_EVERY_MS = 5 * 60 * 1000;
/* A refresh shows its spinning icon at least this long, so a fast reply is still noticed. */
const MIN_SPIN_MS = 700;

const toDate = (iso) => new Date(String(iso).slice(0, 10) + 'T12:00:00');

/* "Maya and Karim" → ['Maya', 'Karim']; a name that doesn't split stays whole. */
const splitCouple = (name) => {
    const parts = (name || '').split(/\s+(?:and|&|et|و)\s+/i).map((s) => s.trim()).filter(Boolean);
    return parts.length === 2 ? parts : [name || ''];
};

const HIDE_KEY = 'ldm-hide-amounts';
const readHidden = () => {
    try { return window.localStorage.getItem(HIDE_KEY) === '1'; } catch (e) { return false; }
};

/* Decoration only: each keepsake card gets the next tint in turn. */
const TINTS = ['var(--ldm-stain-rose)', 'var(--ldm-stain-sage)', 'var(--ldm-stain-amber)', 'var(--ldm-stain-sky)'];

/* Three little sprigs, drawn once, picked per keepsake card. */
const SPRIGS = [
    { stem: 'M4 36C14 28 22 18 30 4', leaves: 'M12 29c-5-1-8-4-9-8 5 0 8 3 9 8zm6-7c1-5 4-8 9-9-1 5-4 8-9 9zm2-6c-5-1-8-4-9-8 5 0 8 3 9 8zm5-7c1-4 3-6 7-7-1 4-3 6-7 7z' },
    { stem: 'M6 38C10 26 18 14 34 6', leaves: 'M10 30c-4-3-5-7-4-11 4 2 5 6 4 11zm5-8c2-4 6-6 10-6-2 4-6 6-10 6zm4-6c-3-3-4-7-3-11 3 3 4 7 3 11zm6-5c2-3 5-5 9-5-2 3-5 5-9 5z' },
    { stem: 'M20 38V8', leaves: 'M20 30c-6 0-10-3-12-8 6 0 10 3 12 8zm0 0c6 0 10-3 12-8-6 0-10 3-12 8zm0-10c-5 0-9-3-10-7 5 0 9 3 10 7zm0 0c5 0 9-3 10-7-5 0-9 3-10 7zm0-9c-2-2-3-5-2-8 2 2 3 5 2 8z' },
];

const Air = () => (
    <div className="ldm-air" aria-hidden="true">
        <span className="ldm-veil ldm-veil-a" />
        <span className="ldm-veil ldm-veil-b" />
        <span className="ldm-veil ldm-veil-c" />
    </div>
);

export function ListeDeMariage() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const view = params.get('view') === 'keepsake' ? 'keepsake' : 'gifts';

    const [state, setState] = useState({ status: 'loading', couple: null, gifts: [], error: '' });
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState('recent');
    const [openId, setOpenId] = useState(null);
    const [hidden, setHidden] = useState(readHidden);
    // The rise-in plays once, when the list first opens. Switching views only crossfades.
    const [intro, setIntro] = useState(true);

    // Background refresh: the list stays on screen while new data is fetched.
    const [refreshing, setRefreshing] = useState(false);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [refreshError, setRefreshError] = useState('');
    const updatedAtRef = useRef(0);
    const busyRef = useRef(false);

    /* First load shows the loading screen; later loads (quiet = true) refresh in place. */
    const load = useCallback((quiet = false) => {
        if (busyRef.current) return;
        busyRef.current = true;
        const started = Date.now();
        if (quiet) setRefreshing(true);
        else setState((s) => ({ ...s, status: 'loading', error: '' }));

        fetchWeddingList()
            .then((data) => {
                setState({ status: 'ready', couple: data.couple, gifts: data.gifts || [], error: '' });
                updatedAtRef.current = Date.now();
                setUpdatedAt(new Date());
                setRefreshError('');
            })
            .catch((err) => {
                // A 401 already sent us back to sign-in. A failed quiet refresh keeps the list on screen.
                if (err.status === 401) return;
                if (quiet) setRefreshError('Could not refresh. We will try again shortly.');
                else setState((s) => ({ ...s, status: 'error', error: err.message }));
            })
            .finally(() => {
                busyRef.current = false;
                const left = MIN_SPIN_MS - (Date.now() - started);
                window.setTimeout(() => setRefreshing(false), Math.max(0, left));
            });
    }, []);

    useEffect(() => { load(); }, [load]);

    // Every 5 minutes while the page is visible; and straight away when the couple comes
    // back to a tab that has been in the background for longer than that.
    useEffect(() => {
        const due = () => Date.now() - updatedAtRef.current >= REFRESH_EVERY_MS;
        const tick = () => { if (document.visibilityState === 'visible' && due()) load(true); };
        const timer = window.setInterval(tick, 30 * 1000);
        document.addEventListener('visibilitychange', tick);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', tick);
        };
    }, [load]);

    useEffect(() => {
        try { window.localStorage.setItem(HIDE_KEY, hidden ? '1' : '0'); } catch (e) { /* storage blocked: keep it in memory */ }
    }, [hidden]);

    const { couple, gifts } = state;

    const setView = (next) => {
        const p = new URLSearchParams(params);
        if (next === 'gifts') p.delete('view'); else p.set('view', next);
        setIntro(false);
        setParams(p);
        window.scrollTo(0, 0);
    };

    const onSignOut = () => {
        signOut();
        navigate('/login', { replace: true });
    };

    /* An amount, or a quiet mask when the couple hides figures. Both sit in the same
       cell and crossfade, so hiding amounts never moves anything on the page. */
    const amt = (text) => (
        <span className={`ldm-amt${hidden ? ' is-hidden' : ''}`}>
            <span className="ldm-amt-value" aria-hidden={hidden || undefined}>{text}</span>
            {hidden
                ? <span className="ldm-amt-mask" role="img" aria-label="Amount hidden" />
                : <span className="ldm-amt-mask" aria-hidden="true" />}
        </span>
    );

    const totals = useMemo(() => totalsOf(gifts), [gifts]);
    const byDateDesc = useMemo(() => [...gifts].sort((a, b) => b.date.localeCompare(a.date)), [gifts]);
    const latest = byDateDesc[0];
    const first = byDateDesc[byDateDesc.length - 1];

    // "Largest first" makes no sense while amounts are hidden.
    const activeSort = hidden && sort === 'amount' ? 'recent' : sort;

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        const list = gifts.filter((g) => !q || g.from.toLowerCase().includes(q) || g.message.toLowerCase().includes(q));
        const sorters = {
            recent: (a, b) => b.date.localeCompare(a.date),
            oldest: (a, b) => a.date.localeCompare(b.date),
            amount: (a, b) => b.amount - a.amount || b.date.localeCompare(a.date),
            name: (a, b) => a.from.localeCompare(b.from),
        };
        return list.sort(sorters[activeSort]);
    }, [gifts, query, activeSort]);

    const visibleTotals = useMemo(() => totalsOf(visible), [visible]);

    const notes = useMemo(() => [...gifts].filter((g) => g.message).sort((a, b) => a.date.localeCompare(b.date)), [gifts]);

    if (state.status !== 'ready') {
        return (
            <div className="ldm">
                <Air />
                <div className="ldm-wrap">
                    <header className="ldm-top">
                        <span className="ldm-wordmark">Liste de mariage</span>
                        <span aria-hidden="true" />
                        <div className="ldm-top-end">
                            <button type="button" className="ldm-signout" onClick={onSignOut}>Sign out</button>
                        </div>
                    </header>
                    {state.status === 'loading' ? (
                        <p className="ldm-loading" role="status">Opening your list…</p>
                    ) : (
                        <div className="ldm-empty ldm-load-error" role="alert">
                            <p className="ldm-empty-title">We could not open your list.</p>
                            <p>{state.error}</p>
                            <button type="button" className="ldm-btn" onClick={load}>Try again</button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const names = splitCouple(couple.name);
    const initials = names.map((n) => n.charAt(0).toUpperCase());
    const coupleTitle = names.length === 2
        ? <>{names[0]} <span className="ldm-amp">&amp;</span> {names[1]}</>
        : names[0];
    const coupleLabel = names.join(' and ');

    const seal = <Seal initials={initials.length === 2 ? initials : [initials[0]]} label={`${coupleLabel} monogram`} />;
    const flourish = <Flourish />;

    return (
        <div className={`ldm${view === 'keepsake' ? ' is-keepsake' : ''}${intro ? ' is-intro' : ''}`}>
            <Air />

            <div className="ldm-wrap">
                {/* ---------- top bar ---------- */}
                <header className="ldm-top">
                    <span className="ldm-wordmark">Liste de mariage</span>

                    <nav className={`ldm-views is-${view}`} aria-label="Views">
                        <div className="ldm-views-row">
                            <button type="button" className="ldm-view" aria-current={view === 'gifts' ? 'page' : undefined} onClick={() => setView('gifts')}>
                                Gifts
                            </button>
                            <button type="button" className="ldm-view" aria-current={view === 'keepsake' ? 'page' : undefined} onClick={() => setView('keepsake')}>
                                Keepsake
                            </button>
                        </div>
                        {/* The same two labels in ink, clipped to the active half: the pill and its
                            text colour slide across together instead of fading separately. */}
                        <div className="ldm-views-row ldm-views-ink" aria-hidden="true">
                            <span className="ldm-view">Gifts</span>
                            <span className="ldm-view">Keepsake</span>
                        </div>
                    </nav>

                    <div className="ldm-top-end">
                        <button
                            type="button"
                            role="switch"
                            aria-checked={!hidden}
                            className={`ldm-switch${view === 'keepsake' ? ' is-away' : ''}`}
                            tabIndex={view === 'keepsake' ? -1 : undefined}
                            aria-hidden={view === 'keepsake' || undefined}
                            onClick={() => setHidden((h) => !h)}
                        >
                            <span className="ldm-switch-track" aria-hidden="true"><span className="ldm-switch-knob" /></span>
                            Show amounts
                        </button>
                        <button
                            type="button"
                            className={`ldm-refresh${refreshing ? ' is-spinning' : ''}`}
                            onClick={() => load(true)}
                            disabled={refreshing}
                            aria-label={updatedAt ? `Refresh the list, last updated at ${timeFmt.format(updatedAt)}` : 'Refresh the list'}
                            title={updatedAt ? `Updated at ${timeFmt.format(updatedAt)}` : 'Refresh'}
                        >
                            <svg viewBox="0 0 20 20" aria-hidden="true">
                                <path d="M16.25 10a6.25 6.25 0 1 1-1.83-4.42" />
                                <path d="M16.5 3.5v3.25h-3.25" />
                            </svg>
                        </button>
                        <button type="button" className="ldm-signout" onClick={onSignOut}>Sign out</button>
                    </div>
                </header>

                <div className="ldm-pane" key={view}>
                {view === 'gifts' ? (
                    <>
                        {/* ---------- hero: the couple and the total ---------- */}
                        <section className="ldm-hero" aria-labelledby="ldm-couple">
                            <div className="ldm-hero-names">
                                {seal}
                                <h1 id="ldm-couple" className="ldm-couple">{coupleTitle}</h1>
                                {couple.remark && <p className="ldm-wed">{couple.remark}</p>}
                                {flourish}
                            </div>

                            <div className="ldm-card ldm-total">
                                <p className="ldm-card-label">Received so far</p>
                                <p className="ldm-total-figure ldm-num">{amt(formatTotals(totals))}</p>
                                <p className="ldm-total-sub">
                                    {gifts.length === 0
                                        ? 'No gifts yet.'
                                        : `${gifts.length} ${gifts.length === 1 ? 'gift' : 'gifts'}, the first on ${longFmt.format(toDate(first.date))}.`}
                                </p>
                            </div>
                        </section>

                        {/* ---------- body ---------- */}
                        <div className="ldm-body">
                            <section className="ldm-ledger" aria-labelledby="ldm-ledger-title">
                                <div className="ldm-ledger-head">
                                    <h2 id="ldm-ledger-title">Every gift, and who sent it</h2>
                                    <p className="ldm-ledger-sum">
                                        <span className="ldm-num">{visible.length}</span> {visible.length === 1 ? 'gift' : 'gifts'}
                                        {visible.length > 0 && (
                                            <span className={`ldm-sum-total${hidden ? ' is-hidden' : ''}`} aria-hidden={hidden || undefined}>
                                                , totalling <span className="ldm-num ldm-ink">{formatTotals(visibleTotals)}</span>
                                            </span>
                                        )}
                                    </p>
                                </div>

                                {gifts.length > 0 && (
                                    <div className="ldm-tools">
                                        <label className="ldm-field ldm-search">
                                            <span className="ldm-field-label">Search a name or a message</span>
                                            <input
                                                type="search"
                                                value={query}
                                                onChange={(e) => setQuery(e.target.value)}
                                                placeholder="A name, a few words…"
                                            />
                                        </label>
                                        <label className="ldm-field">
                                            <span className="ldm-field-label">Order</span>
                                            <select value={activeSort} onChange={(e) => setSort(e.target.value)}>
                                                <option value="recent">Most recent first</option>
                                                <option value="oldest">Oldest first</option>
                                                {!hidden && <option value="amount">Largest first</option>}
                                                <option value="name">By name</option>
                                            </select>
                                        </label>
                                    </div>
                                )}

                                {gifts.length === 0 ? (
                                    <div className="ldm-empty">
                                        <p className="ldm-empty-title">No gifts yet.</p>
                                        <p>When a guest leaves a gift for you at one of our branches, it will appear here with their message.</p>
                                    </div>
                                ) : visible.length === 0 ? (
                                    <div className="ldm-empty">
                                        <p className="ldm-empty-title">No gift matches this search.</p>
                                        <p>Try another name, or clear the search to see every gift again.</p>
                                        <button type="button" className="ldm-btn" onClick={() => setQuery('')}>Clear the search</button>
                                    </div>
                                ) : (
                                    <ol className="ldm-list">
                                        {visible.map((g) => {
                                            const d = toDate(g.date);
                                            const open = openId === g.id;
                                            const money = moneyIn(g.currency).format(g.amount);
                                            return (
                                                <li key={g.id} className={`ldm-row${open ? ' is-open' : ''}`}>
                                                    <button
                                                        type="button"
                                                        className="ldm-row-main"
                                                        aria-expanded={open}
                                                        aria-controls={`ldm-detail-${g.id}`}
                                                        onClick={() => setOpenId(open ? null : g.id)}
                                                    >
                                                        <span className="ldm-date">
                                                            <span className="ldm-day ldm-num">{dayFmt.format(d)}</span>
                                                            <span className="ldm-month">{monthFmt.format(d)}</span>
                                                        </span>
                                                        <span className="ldm-who">
                                                            <span className="ldm-name">{g.from}</span>
                                                            <span className="ldm-sub">Receipt <span className="ldm-num">{g.receiptNo}</span>, {g.location}</span>
                                                        </span>
                                                        <span className="ldm-note-peek">{g.message || 'No message'}</span>
                                                        <span className="ldm-amount ldm-num">{amt(money)}</span>
                                                        <svg className="ldm-chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>
                                                    </button>

                                                    <div className="ldm-fold" id={`ldm-detail-${g.id}`} aria-hidden={!open || undefined}>
                                                        <div className="ldm-fold-inner">
                                                        <div className="ldm-detail">
                                                            <figure className="ldm-card ldm-letter">
                                                                <blockquote>
                                                                    {g.message ? g.message : `${g.from} left the gift without a message.`}
                                                                </blockquote>
                                                                <figcaption>{g.from}</figcaption>
                                                            </figure>
                                                            <dl className="ldm-facts">
                                                                <div><dt>Amount</dt><dd className="ldm-num">{amt(money)}</dd></div>
                                                                <div><dt>Received</dt><dd>{longFmt.format(d)}</dd></div>
                                                                <div><dt>Receipt</dt><dd><span className="ldm-num">{g.receiptNo}</span>, {g.location}</dd></div>
                                                                {couple.accountEnding && <div><dt>Into</dt><dd>Account ending <span className="ldm-num">{couple.accountEnding}</span></dd></div>}
                                                            </dl>
                                                        </div>
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                )}
                            </section>

                            {/* ---------- side ---------- */}
                            {latest && (
                                <aside className="ldm-side">
                                    <figure className="ldm-card ldm-latest">
                                        <p className="ldm-card-label">Latest to arrive</p>
                                        <blockquote>{latest.message || 'A gift without a message.'}</blockquote>
                                        <figcaption>
                                            <span className="ldm-name">{latest.from}</span>
                                            <span className="ldm-latest-meta">
                                                <span className="ldm-num">{amt(moneyIn(latest.currency).format(latest.amount))}</span>, on {longFmt.format(toDate(latest.date))}
                                            </span>
                                        </figcaption>
                                    </figure>
                                </aside>
                            )}
                        </div>
                    </>
                ) : (
                    /* ---------- keepsake: the messages, kept ---------- */
                    <section className="ldm-keepsake" aria-labelledby="ldm-keep-title">
                        <div className="ldm-keep-cover">
                            {seal}
                            <h1 id="ldm-keep-title" className="ldm-keep-title">{coupleTitle}</h1>
                            <p className="ldm-keep-lede">The words our people sent with their gifts.</p>
                            {couple.remark && <p className="ldm-keep-remark">{couple.remark}</p>}
                            {flourish}
                            <div className="ldm-keep-actions">
                                <button type="button" className="ldm-btn" onClick={() => window.print()} disabled={notes.length === 0}>
                                    Print the keepsake
                                </button>
                                <span className="ldm-keep-count">
                                    {notes.length} {notes.length === 1 ? 'message' : 'messages'}, in the order they arrived
                                </span>
                            </div>
                        </div>

                        {notes.length === 0 ? (
                            <div className="ldm-empty">
                                <p className="ldm-empty-title">No messages yet.</p>
                                <p>When a gift arrives with a note, it will be kept here.</p>
                            </div>
                        ) : (
                            <ol className="ldm-keep-grid">
                                {notes.map((g, i) => {
                                    const tint = TINTS[i % TINTS.length];
                                    return (
                                        <li key={g.id} className="ldm-keep-card" style={{ '--ldm-tape': tint }}>
                                            <span className="ldm-tape" aria-hidden="true" />
                                            <svg className={`ldm-sprig ldm-sprig-${i % 3}`} viewBox="0 0 40 40" aria-hidden="true" style={{ color: tint }}>
                                                <path className="ldm-sprig-stem" d={SPRIGS[i % 3].stem} />
                                                <path className="ldm-sprig-leaves" d={SPRIGS[i % 3].leaves} />
                                            </svg>
                                            <blockquote className="ldm-keep-note">{g.message}</blockquote>
                                            <p className="ldm-keep-sign">{g.from}</p>
                                            <p className="ldm-keep-meta">{shortFmt.format(toDate(g.date))}</p>
                                        </li>
                                    );
                                })}
                            </ol>
                        )}

                        <p className="ldm-keep-colophon">
                            Kept by {coupleLabel}, {plainFmt.format(new Date())}.
                        </p>
                    </section>
                )}
                </div>

                <footer className="ldm-foot">
                    <span>{couple.name}</span>
                    <span className={refreshError ? 'ldm-foot-warn' : undefined} role="status">
                        {refreshError || (updatedAt ? `Updated at ${timeFmt.format(updatedAt)}, refreshes every 5 minutes` : '')}
                    </span>
                    {couple.accountEnding && <span>Account ending <span className="ldm-num">{couple.accountEnding}</span></span>}
                </footer>
            </div>
        </div>
    );
}

export default ListeDeMariage;
