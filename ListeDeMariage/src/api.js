/* ---------------------------------------------------------------
   Talking to the backend, and keeping the session alive.

   The session slides: every authenticated response carries a fresh
   60-minute token in the "_auth" header (TokenRefreshMiddleware on the
   API). We swap it in, so the couple stays signed in while they use the
   page, and are signed out after an hour without any request.
---------------------------------------------------------------- */

/* API_BASE comes from public/config.json (loaded in index.js), e.g. "http://server:5213/api". */
const apiBase = () => String((window.__APP_CONFIG__ || {}).API_BASE || '/api').replace(/\/+$/, '');
const TOKEN_KEY = 'ldm-token';
export const SESSION_ENDED = 'ldm:session-ended';

let token = null;
let expiryTimer = null;

try { token = window.sessionStorage.getItem(TOKEN_KEY); } catch (e) { /* storage blocked: memory only */ }

/* exp (seconds) from the JWT payload, or 0 if it can't be read. */
const expiryOf = (jwt) => {
    try {
        const payload = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(window.atob(payload)).exp || 0;
    } catch (e) {
        return 0;
    }
};

const endSession = () => {
    setToken(null);
    window.dispatchEvent(new Event(SESSION_ENDED));
};

function setToken(next) {
    token = next || null;
    try {
        if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
        else window.sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* storage blocked */ }

    // Sign out on the dot when the token lapses, instead of on the next click.
    window.clearTimeout(expiryTimer);
    if (token) {
        const ms = expiryOf(token) * 1000 - Date.now();
        if (ms <= 0) { token = null; return; }
        expiryTimer = window.setTimeout(endSession, Math.min(ms, 2147483647));
    }
}

setToken(token); // validates a token restored from a previous tab session and arms the timer

export const isSignedIn = () => Boolean(token);

/* Thrown for any failed call; .status is the HTTP status (0 when offline). */
export class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

async function request(path, { method = 'GET', body } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
        res = await fetch(`${apiBase()}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) {
        throw new ApiError('We could not reach the server. Check your connection and try again.', 0);
    }

    const refreshed = res.headers.get('_auth');
    if (refreshed) setToken(refreshed.replace(/^Bearer\s+/i, ''));

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        if (res.status === 401 && token) endSession();
        // A 404 without the API's own error body means the address itself is wrong.
        if (res.status === 404 && !(data && data.error))
            throw new ApiError('The server address was not found. Check API_BASE in config.json.', 404);
        throw new ApiError((data && data.error) || 'Something went wrong. Please try again.', res.status);
    }
    return data;
}

/* code and no come from the couple's client card: 3008/0 → code 3008, no 0. */
export async function signIn(username, password) {
    const data = await request('/auth/login', { method: 'POST', body: { username, password } });
    setToken(data.accessToken);
    return data;
}

export function signOut() {
    setToken(null);
}

export const fetchWeddingList = () => request('/wedding');
