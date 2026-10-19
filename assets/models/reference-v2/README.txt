Reference reconstruction of the control unit in generation_null.png

Files
- testing-equipment-reference.blend  Editable Blender scene; opens with the front render camera selected.
- testing-equipment-reference.glb    Geometry and PBR export used by the testing page.
- textures/                         Local, tiling surface maps used by the page's WebGL viewer.
- front.png                         2200 x 1228 transparent product render.
- rear.png                          2200 x 1228 render of the reconstructed rear panel.

Open the .blend file in Blender 5.2 or later. In the 3D viewport, orbit with the middle mouse button and zoom with the wheel. All model pieces are grouped under the "Reference controller - rotate this root" empty.

The visible front, top and left side follow the supplied reference. The unseen rear panel and right side were inferred. Approximate proportions are 480 x 265 x 150 mm and are visual estimates, not measured dimensions. The site loads the GLB and all seven SVG surface maps from this project folder; it does not fetch model or texture files from Blender, a CDN, or another service. The site maps add brushed aluminium, anodized graphite, powder coat, steel, brass, polymer, and rubber grain over the GLB materials.
