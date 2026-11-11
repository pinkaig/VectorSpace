# Model credits

Every bundled model in this folder, where it came from and under what licence.
Add a row when you add a `.glb`. Only CC0 or CC BY models go here. ND ("no derivatives")
licences are out, because shrinking and normalising a model counts as modifying it.
CC BY needs the author's name, a link to the source and the licence, kept with the file.
CC0 asks for no credit, but we give it anyway.

All fossils below were changed the same way by `shrink-glb.mjs`: simplified, textures
re-encoded to WebP, scaled to metres, centred and floor-snapped. Licences were checked on
the Sketchfab API on 6 Nov 2026.

| File | What it is | Source | Author / holder | Licence | Size used |
|---|---|---|---|---|---|
| `Triceratops.glb` | *Triceratops horridus* Marsh, fossil skeleton | [Sketchfab](https://sketchfab.com/3d-models/triceratops-horridus-marsh-e9c507f179ed4455aac3b208c9e6c973) | Smithsonian Institution | CC0 | 5.9 m long: the scan's own scale |
| `Mammoth.glb` | *Mammuthus primigenius* (Blumbach), USNM V23792, Alaska 1952, collector Otto Geist | [Sketchfab](https://sketchfab.com/3d-models/mammuthus-primigenius-blumbach-229976b3db4646b39c44e57a7e3d8744) | Smithsonian Institution, NMNH Paleobiology | CC0 | 3.0 m tall: the scan is 3.28 m, shrunk 8% to fit the 3 m ceilings of our rooms |
| `TRex_Skull.glb` | *Tyrannosaurus rex* skull, cast on display at the Museum of the Earth, Ithaca NY | [Sketchfab](https://sketchfab.com/3d-models/vertebrate-tyrannosaurus-rex-skull-mote-cf48487de55d454b8adc92dce2840a0d) | Digital Atlas of Ancient Life; model by Emily Hauf | CC0 | 1.5 m long (est; the scan came at 3.7 m, not real size) |
| `Ammonite.glb` | Ammonite *Euaspidoceras paucituberkulatum* Arkell, ID 15041, Geological Museum, AGH University of Science and Technology | [Sketchfab](https://sketchfab.com/3d-models/ammonite-euaspidoceras-paucituberkulatum-arkell-617f27f8364d4c908ec1c4e94967858f) | Virtual Museums of Małopolska | CC0 | 0.345 m: the scan is in millimetres |
| `Trilobite.glb` | Trilobite *Elrathia kingii*, PRI 76837 (two specimens, about 4 and 3 cm) | [Sketchfab](https://sketchfab.com/3d-models/trilobite-elrathia-kingii-pri-76837-8791df4f3b1b4ce8abe48fb19921e0d9) | Digital Atlas of Ancient Life | CC0 | 0.12 m slab (est; the specimens are 3-4 cm, the scan came at 1.5 m) |
| `Dinosaur_Footprint.glb` | Dinosaur footprint, cf. *Anomoepus*, Upper Triassic, Tatra Mountains | [Sketchfab](https://sketchfab.com/3d-models/dinosaur-footprint-cf-anomoepus-isp-b7311544e1d84d8ca258b24a32678f0e) | Virtual Museums of Małopolska | CC0 | 0.29 m: the scan's own scale |

Not used: the rigged "Animated triceratops skeleton" by Zacxophone (CC0, built on the
Smithsonian scan). The app clones models with `Object3D.clone()` (`modelCache.ts`), which
leaves a skinned mesh tied to the original skeleton, and nothing plays glTF animations.
Using it would need `SkeletonUtils.clone` and an AnimationMixer. If it is ever added, credit
Zacxophone and the Smithsonian both.

Sizes marked (est) are guesses, because the scan was not at real scale. Correct them
from the museum object page and re-run shrink-glb.mjs if one looks wrong.

`Pedestal.glb`, `Stanchion.glb`, `arrow.glb`, `sign.glb`: origin not recorded. Git history only goes back to the folder reorganisation (`04556ba`, chloelau). Ask the team where they came from and add rows.
