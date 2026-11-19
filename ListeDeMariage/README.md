# Liste de mariage

The couple's wedding gift list: every gift left for them at the shop's branches, who left it, the message that came with it, and a printable keepsake of those messages.

## Run it

Start the backend first (`BackeEnd/ListeDeMariage.sln`, project `Main`, profile `http`, on `http://localhost:5213`), then:

```
npm install
npm start
```

It opens on `http://localhost:3000/#/login`.

## The API address

It lives in `public/config.json` (copied as `config.json` next to `index.html` in `build/`):

```json
{ "API_BASE": "http://localhost:5213/api" }
```

The page reads it on every load, so on the server you can edit `config.json` in the IIS folder without rebuilding.

## Signing in

The couple signs in with their client code and number, written `code/no`, as both the code and the password. For client 3008, number 0, that is `3008/0` and `3008/0`.

The session lasts an hour from the last action. Each call to the API sends back a fresh token in the `_auth` header, and the page swaps it in. After an hour with no activity, the page goes back to sign-in.

## Where things are

- `src/api.js`: calls to the backend, the token, and signing out when it expires.
- `src/ListeDeMariage/Login.jsx`: the sign-in page.
- `src/ListeDeMariage/ListeDeMariage.jsx`: the gift list and the keepsake (`#/liste-de-mariage?view=keepsake`).
- `src/ListeDeMariage/ListeDeMariage.css`: all the styles, scoped under `.ldm`.

## Where the data comes from

`GET /api/wedding` returns the signed-in client's list:

- **Gifts:** `POS_RCListDeMariage` (from, message), joined on location and recid to its `RC` receipt in `POS_SALEINVHEAD` (amount, currency, date). Every branch is included.
- **Couple:** `Stk04_Clients.CL_Name`. The line under the names is `Com_Folio.Fo_remark`, shown as written.
- **Account:** `STk04_ClAccounts.CA_CLAc` (first 11 characters, last 4 shown), for the company set in `Wedding:AccountCompany` in the API's `appsettings.json`.

## Publish on IIS

Run `npm run build`, copy the contents of `build/` into the IIS site folder, and set `API_BASE` in that folder's `config.json` to the published API address (ending in `/api`). No URL Rewrite needed: the app uses `#` addresses, so IIS only ever serves `index.html`. It also works from a sub-folder (`http://server/liste/`).
