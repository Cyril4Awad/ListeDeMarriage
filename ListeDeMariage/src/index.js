import React from 'react';
import ReactDOM from 'react-dom';
import { HashRouter } from 'react-router-dom';
import './index.css';
import App from './App';

/* config.json sits next to index.html, so the API address can be changed on the
   server without rebuilding. Read it first (never from cache), then start the app. */
fetch(`${process.env.PUBLIC_URL}/config.json`, { cache: 'no-store' })
    .then((res) => res.json())
    .then((config) => { window.__APP_CONFIG__ = config; })
    .catch(() => { window.__APP_CONFIG__ = {}; })
    .finally(() => {
        ReactDOM.render(
            <React.StrictMode>
                <HashRouter>
                    <App />
                </HashRouter>
            </React.StrictMode>,
            document.getElementById('root')
        );
    });
