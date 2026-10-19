"""Rebuild reference geometry with outward normals and portable surface maps.
Run using Blender --background --python tools/build_testing_equipment_v3.py.
The v2 source and assets remain available for comparison.
"""
from pathlib import Path
import bpy

source_path = Path(__file__).with_name('build_testing_equipment_reference.py')
source = source_path.read_text(encoding='utf-8')
source = source.replace('import bpy', 'import bpy\nimport bmesh')
source = source.replace("OUT = ROOT / 'assets/models/reference-v2'", "OUT = ROOT / 'assets/models/reference-v3'")
# The hand-extruded profiles had inward faces: booleans left metal across
# the socket openings. Recalculate before applying any boolean operation.
source = source.replace('mesh.update()', '''mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()''')
source = source.replace('c.size=size', 'c.size=size * (1.38 if not back else 1.0)')
source = source.replace('b.width, b.segments = bevel, 4', 'b.width, b.segments = bevel, 8')
source = source.replace("if o.type == 'MESH':", "if o.type == 'MESH':\n        for face in o.data.polygons: face.use_smooth = True")
source = source.replace("acx,-1.367,.925,.073", "acx,-1.367,.84,.073")
source = source.replace("sx,-1.367,.925,.07", "sx,-1.367,.805,.07")
source = source.replace("dbx,-1.367,.84,.07", "dbx,-1.367,.805,.07")
# Export before offline rendering, keeping the site and the .blend in sync.
source = source[:source.index('# Keep native materials')]+'''
bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'testing-equipment-reference.blend'))
for o in list(scene.objects):
    o.select_set(o.type in {'FONT','CURVE'})
bpy.context.view_layer.objects.active=next(o for o in scene.objects if o.select_get())
bpy.ops.object.convert(target='MESH')
for o in scene.objects: o.select_set(o.type=='MESH' or o==root)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(OUT/'testing-equipment-reference.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False)
'''
exec(compile(source, str(source_path), 'exec'))
