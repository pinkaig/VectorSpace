# Credits & Third-Party Notices

This file is the **source of truth** for every third-party asset, library, dataset, or map/terrain
tile source used by the ChargedUp Cross-Site Energy & Sustainability Simulator that requires
attribution. If it's not listed here, treat it as unverified.

## How to use this file

**Before adding a new dependency, dataset, basemap/terrain provider, icon set, or any other
third-party asset:**

1. Check its license. Permissive licenses (MIT, Apache 2.0, BSD) are generally safe to use with a
   credit entry below. GPL/AGPL, "non-commercial only," or unclear/missing licenses need a
   decision before merging — ask first.
2. Add an entry under the matching section below (or create a new section if it doesn't fit).
3. If the license text must legally be redistributed (e.g. MIT, Apache 2.0 require the license
   text to travel with the software), paste the full text in the **License Texts** section at
   the bottom and link to it from the entry.
4. If the asset is visible to end users at runtime (map tiles, terrain, imagery), also check
   whether its license requires on-screen attribution — note that in the entry's "Runtime
   attribution" field, and do not remove/hide that attribution UI once it exists.

**Entry format:**

```
- **<Name>** — <what it's used for>
  - License: <SPDX id or name>
  - Source: <URL>
  - Runtime attribution required: <yes/no, and where it's shown if yes>
```

Keep entries alphabetical within each section. Do not remove an entry just because a dependency
was uninstalled — move it to a "no longer used" note or delete it in the same commit that removes
the dependency, so this file always reflects what's actually shipping.

---

## Core Libraries

- **CesiumJS** — 3D globe/terrain rendering engine
  - License: Apache 2.0
  - Source: https://github.com/CesiumGS/cesium
  - Runtime attribution required: **yes, and this is not optional.** Cesium's built-in credit
    display (bottom-right corner of the `Viewer`/`CesiumWidget`) must stay visible whenever
    Cesium World Terrain, Bing Maps imagery, or any other Cesium ion asset is used — ion's terms
    require this and it cannot be hidden or styled away. As of now Cesium is only declared in
    [`frontend/package.json`](frontend/package.json) and not yet wired into a `Viewer` — **when
    someone does mount the first Cesium viewer, confirm the credit container is on-screen and
    add the specific data source(s) used (e.g. Cesium World Terrain, Bing Maps Aerial) as their
    own entries below.**

- **React / React DOM** — UI framework
  - License: MIT
  - Source: https://github.com/facebook/react
  - Runtime attribution required: no

- **Recharts** — charting library
  - License: MIT
  - Source: https://github.com/recharts/recharts
  - Runtime attribution required: no

- **Vite** — build tool / dev server
  - License: MIT
  - Source: https://github.com/vitejs/vite
  - Runtime attribution required: no

- **TypeScript** — language/compiler
  - License: Apache 2.0
  - Source: https://github.com/microsoft/TypeScript
  - Runtime attribution required: no

## Backend Libraries (apps/api)

- **FastAPI**, **Uvicorn**, **httpx**, **Pydantic Settings**, **SQLAlchemy**, **Alembic**,
  **psycopg**, **boto3**, **python-jose** — all permissive (MIT/Apache 2.0/BSD), server-side
  only, no runtime attribution required. Listed here for completeness; see
  [`frontend/package.json`](frontend/package.json) and `apps/api/requirements.txt` for exact
  versions.

## Map / Terrain / Imagery Data Sources

*(none wired in yet — add each specific provider here the moment a Cesium ion asset ID or basemap
URL is added to the code, per the Cesium note above)*

---

## License Texts

### MIT License (React, React DOM, Recharts, Vite)

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Apache License 2.0 (CesiumJS, TypeScript)

Full text: https://www.apache.org/licenses/LICENSE-2.0
