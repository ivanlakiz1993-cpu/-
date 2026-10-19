"""Align the two POWER legends on the reference controller and refresh exports."""
from pathlib import Path
import bpy

root = Path(__file__).resolve().parents[1]
out = root / 'assets/models/reference-v2'
blend = out / 'testing-equipment-reference.blend'
bpy.ops.wm.open_mainfile(filepath=str(blend))

# Keep all front-panel headers on one typographic baseline above their hardware.
for name in ('Switch power label', 'Indicator legend', 'DB9 top legend'):
    obj = bpy.data.objects.get(name)
    if obj is None:
        raise RuntimeError(f'Missing expected label: {name}')
    obj.location.z = .84 if name == 'Indicator legend' else .805

scene = bpy.context.scene
scene.camera = bpy.data.objects.get('Reference front-left camera')
scene.render.filepath = str(out / 'front.png')
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.render.render(write_still=True)

# Export a fresh GLB, converting editable text and curves for glTF support.
bpy.ops.object.select_all(action='DESELECT')
for obj in list(scene.objects):
    if obj.type in {'FONT', 'CURVE'}:
        obj.select_set(True)
bpy.context.view_layer.objects.active = next(o for o in scene.objects if o.select_get())
bpy.ops.object.convert(target='MESH')
bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
    if obj.type == 'MESH' or obj.name == 'Reference controller - rotate this root':
        obj.select_set(True)
bpy.context.view_layer.objects.active = bpy.data.objects['Reference controller - rotate this root']
bpy.ops.export_scene.gltf(
    filepath=str(out / 'testing-equipment-reference.glb'),
    export_format='GLB', use_selection=True, export_apply=True, export_animations=False,
)
print('Updated power legend positions and front render')
