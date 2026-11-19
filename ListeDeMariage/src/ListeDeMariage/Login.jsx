import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { isSignedIn, signIn } from '../api';
import { Flourish, Seal } from './Ornaments';
import './ListeDeMariage.css';

export function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(location.state?.expired ? 'Your session ended after an hour away. Please sign in again.' : '');

    if (isSignedIn()) return <Navigate to="/liste-de-mariage" replace />;

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!code.trim() || !password.trim()) {
            setError('Please enter your code and your password.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            await signIn(code.trim(), password.trim());
            const back = location.state?.from;
            navigate(back ? `${back.pathname}${back.search}` : '/liste-de-mariage', { replace: true });
        } catch (err) {
            setError(err.status === 401 ? 'Wrong code or password. Please try again.' : err.message);
            setBusy(false);
        }
    };

    return (
        <div className="ldm ldm-login-page">
            <div className="ldm-air" aria-hidden="true">
                <span className="ldm-veil ldm-veil-a" />
                <span className="ldm-veil ldm-veil-b" />
                <span className="ldm-veil ldm-veil-c" />
            </div>

            <main className="ldm-invite">
                <form className="ldm-invite-card" onSubmit={onSubmit} noValidate aria-labelledby="ldm-invite-title">
                    <Seal initials={['&']} label="Liste de mariage seal" className="ldm-invite-seal" />

                    <div className="ldm-invite-head">
                        <p className="ldm-invite-kicker">Liste de mariage</p>
                        <h1 id="ldm-invite-title" className="ldm-invite-title">Bienvenue</h1>
                        <Flourish className="ldm-invite-flourish" />
                        <p className="ldm-invite-lede">
                            Every gift your guests leave for you, and the words they wrote with it, kept in one place.
                        </p>
                    </div>

                    <div className="ldm-invite-fields">
                        <label className="ldm-field">
                            <span className="ldm-field-label">Code</span>
                            <input
                                name="username"
                                autoComplete="username"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                aria-invalid={Boolean(error) || undefined}
                                aria-describedby="ldm-invite-help"
                                autoFocus
                            />
                        </label>

                        <label className="ldm-field">
                            <span className="ldm-field-label">Password</span>
                            <input
                                type="password"
                                name="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                aria-invalid={Boolean(error) || undefined}
                            />
                        </label>
                    </div>

                    <p className="ldm-invite-error" role="alert" aria-live="polite">{error}</p>

                    <button type="submit" className="ldm-invite-btn" disabled={busy}>
                        <span>{busy ? 'Opening your list…' : 'Open our list'}</span>
                    </button>

                    <p className="ldm-invite-help" id="ldm-invite-help">
                        Your code and password are on the card we gave you when you opened your list.
                    </p>
                </form>
            </main>
        </div>
    );
}

export default Login;
