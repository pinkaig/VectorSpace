Team 17 - DoReMi-yaki

Members:
Product Manager		Carrie Lam Tze Ying  2401405	(lam.c@digipen.edu)
Tech Lead		Sherman Goh Wee Hao  2301472	(shermanweehao.goh@digipen.edu)
Programmer		Chloe Lau Rey En     2402250	(l.chloereyen@digipen.edu)
Programmer		Tee Ming Zhe, Daniel 2200679	(m.tee@digipen.edu)
Programmer		Goh Pin Kai	     2301388	(pinkai.g@digipen.edu)
Programmer		Wei An CHING	     2202589	(weian.ching@digipen.edu)

			
Description:
The actual project lives in VThere Spatial Experience Builder: 
a browser-based spatial authoring tool 
(Vite/React/TypeScript frontend, Python/FastAPI backend(not in used)).


Github Wiki + M1 deliverable:
https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki
Jira board:
https://doremiyaki.atlassian.net/jira/software/projects/PROJ5/summary
Active front-end website via Render,
https://vthere-spatial-experience-builder.onrender.com/

One-command build, test, and run
./run.sh          # macOS/Linux
run.bat           # Windows


Prerequisite: 
Node.js 22+ (bundles a compatible npm). 
Then —
`npm ci` and Playwright's own Chromium install handle the rest.


==================================================================================
Minimum Viable Product (M1)

The M1 deliverable is a **browser-only scene authoring tool**: 
open the app, 
(authoring)   build a spatial scene out of primitives and bundled 3D models, 
(persistence) and get back to it later. 


Features:
- Place, select, and transform (move/rotate/scale) objects in a 3D viewport,
  with undo/redo and orbit/walk navigation.
- Organize objects in a scene tree, across multiple scenes in one project.
- Attach audio and text content to objects and preview it in-editor (`Run simulation` button).
- Import a custom model (GLB/glTF), which runs through an automatic
  optimization pipeline (dedup/weld/simplify against a triangle/texture
  budget) before use.
- Save the project to `localStorage` and reload it exactly as left, or
  export/import it as JSON.

Deliberately not part of this MVP: 
-backend/database, 
-user accounts or auth, 
-cloud sync 
 (the queue/retry/conflict-detection logic exists and is tested,
  but there is no server to sync against,
-automated deployment 
 (CI runs on every push/PR; 
  CD is scaffolded but not wired to trigger on merge,
  we don't have a full stack yet ._.). 


To Get Started on the app:
(Project is already created)
`Scene Tree`
1. 	Add Scenes to your Project.
 1.1	By Default, on the [LHS panel], you should be on 'Scene'
 1.2	Click on the '+' Button to add rooms.
 1.3	The highlighted box will be the selected room,
 1.4 	You can preview the room with the '>' and '⌄' icon. 


[Top 2nd Banner] 
2.	Add and Manipulate Objects		
 2.1	Go to the `Assets` tab on the [LHS panel], 
 2.2	Click on `Model` listing to Add Objects.
 2.3	It will appear in the middle of the plane.
 2.4	On the Top-Middle, there will be 'Select', 'Move', 'Scale', 'Rotate'.
 2.5	Pick one and use the 3D-spatial Gizmos (x,y,z axis)
 2.6	In the center of the ObjectxGizmo, there will be a uniform operation, 
 2.7	In 'Scale'&'Rotate', there is Local(wrt the Model) and World(wrt the Plane transformations.


[Top 3rd Banner] 
3.	Changing 3D Environment			
 3.1	You are able to pick a curated environment models.
 3.2	Select from the dropdown menu.

4.	Camera Controls			
 4.1	By default, you will be in Orbit move, 
	it moves about a pivot.
 4.2	Next to `Environment`, you can change btw 'Orbit' and 'Walk'
 4.3	In `Orbit', Drag LMB(left mouse button) to move the camera.
 4.4	In `Walk`, Use 'W','A','S','D', 'X'(up),'C'(down), 
	'Shift' key to sprint.

4.a	Camera Zooming Feature
 4.a.1	Scroll the MMB to zoom in and out.

5.	Camera Modes
 5.1	By default, you are in 'Perspective'
 5.2	'Orthographics', triggers the 4 viewports,
	where the Left-Top is the free-camera view.

6.	QoL `OctaOrb`, `Axes`
 6.1	`OctaOrb` allows user to change the viewing angle,
 6.2	You can choose intervals between 45degs.
	Hover over the Yellow-Orbs to choose the respective perspectives.
 6.3	`Axes` shows the global axis direction at any point.

7.	Misc resetting point of Camera.
 7.1	Change it on 'Set start view'
 7.2	Return back with 'Reset view'


[LHS Panel]
`Assets` Panel
8.	Importing in Models
 8.1	You can drag-and-drop .glb/.gltf models, it would persist in the browser

9.	Importing Audio
 9.1	You can drag-and-drop .mp3/.ogg/.wav format audios, 
	it would validate and check if audio is working.

10.	Misc (Bottom of Panel)
 10.1	`Reset draft` clears the Project entirely.

`Interact` Panel
11.	Not included in M1.
 11.1	Will serve as the visualisation and edit panel of when-DO interactions.


[RHS Panel]
12.	Object Inspector
 12.1	After selecting/clicking on an Object, the Inspector pops out on the RHS.
 12.2	`Object name` 
	Can be changed, Objects are identified by their unique id.
 12.3	`Parent`
	Parent-Child hierarchy, 
	whereby this relationship will influence their transformation, and
	Parents will know and have access to their children. 
	* this helps with grouping of objects together.
12.3.a 	On the [LHS Panel], under `Scene`, Objects will indent accordingly
	to their parent. 
12.3.b	More left indents, child of an object above.
 12.4	`Asset ID` , not in used 
12.4.a 	Used with Asset Manager once all asset types are integrated.
 12.5	Object Management
12.5.a	`Visible`, to render or not to render
12.5.b	`Enabled`, relates to the When-DO interactions for now.
 12.6	Object Transformation
12.6.a	`Position` Translate,
12.6.b	`Rotation` Rotate,
12.6.c	`Scale`
 12.7	`Interactions`
12.7.a	`When the visitor`
	This is the trigger conditions for the object: 
	currently,
	-LMB Click on the Object.
	in the future,
	-User looking at,
	-User entering/leaving/staying in a zone.
12.7.b	`then`
	This is the logic/scripting of the object:
	-Change Model's Colour
	-Play an Audio
	-Display a 2D overlay Text.
12.7.c	When Done, REMEMBER to do `Add Interaction`
	Verify that interaction exist (scroll down)
 12.8	Object Management
12.8.a	`Duplicate` , deep copies the object and children.
12.8.b	`Delete`    , deletes the object and children.


[Top 1st Banner] 
13	Undo/Redo System
	It will record when xyz occurs:
	Object Transformation,
	Object Management,
	Interaction Creation/Deletion.
14	`Load draft`
	Does nothing much as auto-save occurs before you use it.
15	`Load Audio Demo`
	Loads in:
	1 Main BGM playing
	4 Sec BGM, using zone triggers
	3 Sfx playing Objects (exist in the scene tree).
16/17	`Import/Export JSON`
	Alternative method to save the project checkpoints.
18	`Save project`
	Does nothing much as auto-save occurs before you use it.
19	`Run simulation`
	Puts the editor application to `preview` mode, 
	which is the runtime.


[During `Preview` mode]
User is put in 1st person pov.
	'W','A','S','D' to walk,
	Move mouse to look.
For now, collision is not implemented, users can phase through walls.
For Users to "click" on something, it would be wrt the crosshair.
`esc` key to get control of mouse,
`esc` key a second time to get out of `Preview` mode.
`R` key to restart the simulation.



==================================================================================
Commit and merge rules

- Branch from `Working`;
- Open a pull request for every merge into `Working` — 
  no direct pushes to `Working`. 
- CI (`.github/workflows/ci.yml`: 
  install → typecheck → unit tests → build → Playwright e2e) 
  runs on every push and PR targeting `Working` & `main`; 
  a PR should not be merged with a failing run.
- Get the tech lead's approval and they will merge the PRs.
- Reference the relevant Jira issue key in the branch name or PR description
  when one exists.
