# Credits & Third-Party Notices

This file is the **source of truth** for every third-party asset, library, font, or dataset
used by VThere Spatial Experience Builder that requires attribution. If it's not listed here,
treat it as unverified.

## How to use this file

**Before adding a new dependency, font, icon set, 3D model, texture, audio clip, or any other
third-party asset:**

1. Check its license. Permissive licenses (MIT, Apache 2.0, BSD, OFL) are generally safe to use
   with a credit entry below. GPL/AGPL, "non-commercial only," or unclear/missing licenses need
   a decision before merging — ask first.
2. Add an entry under the matching section below (or create a new section if it doesn't fit).
3. If the license text must legally be redistributed (e.g. MIT, Apache 2.0 require the license
   text to travel with the software), paste the full text in the **License Texts** section at
   the bottom and link to it from the entry.
4. If the asset is visible/audible to end users at runtime (a font, a 3D model, a sound), also
   check whether its license requires on-screen/in-app attribution (not just this file) — note
   that in the entry's "Runtime attribution" field.

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

## Fonts

- **DM Mono** — UI monospace font, loaded via Google Fonts (`fonts.googleapis.com`) in
  [`src/styles.css`](src/styles.css)
  - License: SIL Open Font License 1.1
  - Source: https://fonts.google.com/specimen/DM+Mono
  - Runtime attribution required: no (OFL does not require it), listed here for transparency

- **Manrope** — UI body/heading font, loaded via Google Fonts (`fonts.googleapis.com`) in
  [`src/styles.css`](src/styles.css)
  - License: SIL Open Font License 1.1
  - Source: https://fonts.google.com/specimen/Manrope
  - Runtime attribution required: no (OFL does not require it), listed here for transparency

## Core Libraries

- **React / React DOM** — UI framework
  - License: MIT
  - Source: https://github.com/facebook/react
  - Runtime attribution required: no

- **three.js** — WebGL/3D rendering engine powering the spatial runtime
  - License: MIT
  - Source: https://github.com/mrdoob/three.js
  - Runtime attribution required: no

- **Vite** — build tool / dev server
  - License: MIT
  - Source: https://github.com/vitejs/vite
  - Runtime attribution required: no

- **TypeScript** — language/compiler
  - License: Apache 2.0
  - Source: https://github.com/microsoft/TypeScript
  - Runtime attribution required: no

## User-Uploaded Assets (Images, Video, Audio, 3D Models)

Authors can upload their own images/video/audio through the asset manager. This project's data
model already reserves a `credit` field on image and video asset records
(see [`docs/code/subsystems/image-system.md`](docs/code/subsystems/image-system.md) and
[`docs/code/subsystems/video-system.md`](docs/code/subsystems/video-system.md)) to store
attribution text supplied at upload time.

- This file does **not** enumerate individual user-uploaded assets — those are tracked per-project
  in the asset's own `credit` metadata, not here.
- If the team curates a shared/bundled asset library (stock models, textures, sound effects) that
  ships with the product itself rather than being uploaded per-project, list each one here under
  its own subsection using the entry format above.

---

## License Texts

### MIT License (React, React DOM, three.js, Vite)

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

### SIL Open Font License 1.1 (DM Mono, Manrope)

Full text: https://openfontlicense.org
