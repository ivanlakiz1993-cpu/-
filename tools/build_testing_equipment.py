"""Build the reconstructed SpecElectronics test unit in Blender.

Run from the repository root with Blender's bundled Python:
  blender --background --python tools/build_testing_equipment.py
"""

from pathlib import Path
import math
import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "models"
OUTPUT.mkdir(parents=True, exist_ok=True)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)


def make_metal(name, color, metallic=0.78, roughness=0.32, brush=150.0, bump=0.014):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness

    texcoord = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeVectorMath")
    mapping.operation = "MULTIPLY"
    mapping.inputs[1].default_value = (brush, 4.0, brush * 0.38)
    links.new(texcoord.outputs["Generated"], mapping.inputs[0])
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 2.8
    noise.inputs["Detail"].default_value = 3.0
    noise.inputs["Roughness"].default_value = 0.72
    links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    bump_node = nodes.new("ShaderNodeBump")
    bump_node.inputs["Strength"].default_value = 0.16
    bump_node.inputs["Distance"].default_value = bump
    links.new(noise.outputs["Fac"], bump_node.inputs["Height"])
    links.new(bump_node.outputs["Normal"], shader.inputs["Normal"])

    roughness_noise = nodes.new("ShaderNodeMapRange")
    roughness_noise.inputs["From Min"].default_value = 0.0
    roughness_noise.inputs["From Max"].default_value = 1.0
    roughness_noise.inputs["To Min"].default_value = max(0.12, roughness - 0.06)
    roughness_noise.inputs["To Max"].default_value = min(0.85, roughness + 0.09)
    links.new(noise.outputs["Fac"], roughness_noise.inputs["Value"])
    links.new(roughness_noise.outputs["Result"], shader.inputs["Roughness"])
    return material


def make_solid(name, color, metallic=0.0, roughness=0.45, emission=None):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if emission:
        color_input = shader.inputs.get("Emission Color") or shader.inputs.get("Emission")
        strength_input = shader.inputs.get("Emission Strength")
        if color_input:
            color_input.default_value = (*color, 1)
        if strength_input:
            strength_input.default_value = emission
    return material


def finish_mesh(obj, bevel=0.0, segments=3, weighted=True):
    if bevel > 0:
        modifier = obj.modifiers.new("Soft machined edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = segments
        modifier.profile = 0.5
    if weighted:
        modifier = obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
        modifier.keep_sharp = True
        modifier.weight = 35
    return obj


def box(name, location, dimensions, material, bevel=0.0, rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    if rotation:
        obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        obj.data.materials.append(material)
    return finish_mesh(obj, bevel, segments=6)


def cylinder(name, location, radius, depth, material, axis="Y", vertices=48, bevel=0.0):
    rotation = {
        "X": (0, math.pi / 2, 0),
        "Y": (math.pi / 2, 0, 0),
        "Z": (0, 0, 0),
    }[axis]
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, end_fill_type="NGON",
        location=location, rotation=rotation
    )
    obj = bpy.context.object
    obj.name = name
    if material:
        obj.data.materials.append(material)
    return finish_mesh(obj, bevel)


def torus(name, location, major, minor, material, axis="Y"):
    rotation = (math.pi / 2, 0, 0) if axis == "Y" else (0, 0, 0)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor, major_segments=48,
        minor_segments=12, location=location, rotation=rotation
    )
    obj = bpy.context.object
    obj.name = name
    if material:
        obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def uv_sphere(name, location, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def text_front(name, content, location, size, material, font=None):
    curve = bpy.data.curves.new(name, type="FONT")
    curve.body = content
    curve.size = size
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.extrude = 0.0008
    curve.bevel_depth = 0.0003
    if font:
        curve.font = font
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    # Silkscreen must sit just outside the front panel (face at y ~= -1.03).
    surface_y = location[1] - 0.045 if location[1] > -1.05 else location[1]
    obj.location = (location[0], surface_y, location[2])
    obj.rotation_euler = (math.pi / 2, 0, 0)
    obj.data.materials.append(material)
    return obj


def text_back(name, content, location, size, material, font=None):
    obj = text_front(name, content, location, size, material, font)
    obj.location = location
    obj.rotation_euler = (-math.pi / 2, 0, math.pi)
    return obj


def screw_front(name, x, z, y, radius=0.052):
    cylinder(name + " bezel", (x, y + 0.012, z), radius * 1.2, 0.022, black, bevel=0.004)
    cylinder(name + " stainless head", (x, y - 0.004, z), radius, 0.018, steel, bevel=0.006)
    box(name + " cross slot A", (x, y - 0.015, z), (radius * 1.05, 0.004, radius * 0.16), slot, 0.001)
    box(name + " cross slot B", (x, y - 0.016, z), (radius * 0.16, 0.004, radius * 1.05), slot, 0.001)


def screw_top(name, x, y, z, radius=0.047):
    cylinder(name + " countersink", (x, y, z - 0.006), radius * 1.24, 0.018, black, axis="Z", vertices=48, bevel=0.004)
    cylinder(name + " steel head", (x, y, z + 0.002), radius, 0.012, steel, axis="Z", vertices=48, bevel=0.004)
    box(name + " slot A", (x, y, z + 0.009), (radius * 1.05, radius * 0.14, 0.003), slot, 0.001)
    box(name + " slot B", (x, y, z + 0.010), (radius * 0.14, radius * 1.05, 0.003), slot, 0.001)


def round_connector(name, x, z, label, font, style="multi"):
    front = -1.0
    # Deep socket barrel, a machined hex nut and several turned metal lips.
    cylinder(name + " barrel", (x, front - 0.034, z), 0.154, 0.105, connector_body, vertices=12, bevel=0.008)
    torus(name + " outer rim", (x, front - 0.095, z), 0.139, 0.023, steel)
    torus(name + " knurled rim", (x, front - 0.115, z), 0.119, 0.012, nickel)
    torus(name + " inner lip", (x, front - 0.121, z), 0.092, 0.009, steel)
    cylinder(name + " recessed insulator", (x, front - 0.119, z), 0.088, 0.018, socket_black, vertices=48, bevel=0.003)
    torus(name + " contact ring", (x, front - 0.132, z), 0.065, 0.005, gold)

    # Metal pins sit at different depths in the dark insulating core.
    pin_points = [(0, 0)]
    count = 6 if style == "multi" else 4
    for index in range(count):
        angle = index * (2 * math.pi / count) + math.pi / 6
        pin_points.append((math.cos(angle) * 0.047, math.sin(angle) * 0.047))
    for index, (dx, dz) in enumerate(pin_points, 1):
        cylinder(
            f"{name} contact {index}",
            (x + dx, front - 0.139, z + dz),
            0.011 if index else 0.013, 0.024, gold, vertices=20, bevel=0.002
        )
    # Pair of jack screws on the flange.
    for side in (-1, 1):
        cylinder(f"{name} flange screw {side}", (x + side * 0.18, front - 0.054, z), 0.022, 0.018, steel, vertices=24, bevel=0.003)
        box(f"{name} flange slot {side}", (x + side * 0.18, front - 0.065, z), (0.025, 0.003, 0.004), slot, 0.001)
    text_front(name + " legend", label, (x, front - 0.008, z + 0.235), 0.072, label_white, font)


def add_side_vents(sign, material):
    x = sign * 1.602
    # Recessed louvers placed on both side walls.
    for row in range(7):
        z = -0.20 + row * 0.061
        box(f"Side {sign} vent shadow {row}", (x, 0.12, z), (0.012, 0.66, 0.026), socket_black, 0.012)
        box(f"Side {sign} vent lip {row}", (x + sign * 0.009, 0.12, z + 0.012), (0.012, 0.66, 0.006), material, 0.003)
    for y in (-0.72, 0.72):
        for z in (-0.31, 0.29):
            cylinder(f"Side {sign} chassis screw", (x + sign * 0.012, y, z), 0.039, 0.014, steel, axis="X", vertices=32, bevel=0.004)


def add_round_connector_on_back(name, x, z):
    front = 1.0
    cylinder(name + " rear shell", (x, front + 0.035, z), 0.125, 0.11, connector_body, axis="Y", vertices=12, bevel=0.008)
    torus(name + " rear collar", (x, front + 0.095, z), 0.114, 0.018, steel)
    cylinder(name + " rear socket", (x, front + 0.112, z), 0.076, 0.016, socket_black, vertices=40, bevel=0.002)
    for index in range(5):
        dx = (index - 2) * 0.026
        cylinder(f"{name} rear pin {index}", (x + dx, front + 0.123, z), 0.008, 0.014, gold, vertices=16)


clear_scene()

# Visual materials: black anodized enclosure, brushed connector panel,
# machined nickel/stainless hardware, gold contacts and rubber feet.
black_metal = make_metal("Anodized graphite - fine brushed", (0.012, 0.014, 0.017), 0.68, 0.39, 210, 0.012)
lid_metal = make_metal("Lid - satin black aluminum", (0.004, 0.005, 0.006), 0.05, 0.62, 240, 0.01)
panel_metal = make_metal("Front panel - brushed black aluminum", (0.008, 0.010, 0.013), 0.76, 0.36, 360, 0.008)
steel = make_metal("Stainless steel", (0.48, 0.51, 0.53), 0.9, 0.22, 90, 0.006)
nickel = make_metal("Connector nickel", (0.68, 0.69, 0.66), 0.88, 0.2, 130, 0.004)
gold = make_metal("Gold plated contacts", (0.72, 0.39, 0.105), 0.83, 0.2, 75, 0.003)
connector_body = make_metal("Dark nickel connector shells", (0.16, 0.18, 0.20), 0.88, 0.24, 115, 0.004)
black = make_solid("Deep black polymer", (0.008, 0.010, 0.012), 0.12, 0.37)
socket_black = make_solid("Connector cavity", (0.003, 0.004, 0.005), 0.05, 0.62)
slot = make_solid("Screw recess", (0.003, 0.004, 0.005), 0.0, 0.68)
rubber = make_solid("Rubber feet", (0.018, 0.020, 0.022), 0.0, 0.78)
label_white = make_solid("Silkscreen white", (0.78, 0.81, 0.82), 0.08, 0.48)
led_green = make_solid("Power LED green", (0.025, 0.52, 0.12), 0.05, 0.2, emission=1.3)
led_dark = make_solid("LED bezel black", (0.007, 0.009, 0.01), 0.2, 0.35)

font_path = Path("C:/Windows/Fonts/arial.ttf")
font = bpy.data.fonts.load(str(font_path)) if font_path.exists() else None

# Chassis and separate lid preserve a real seam and bevelled silhouette.
body = box("01 · Die-cast main enclosure", (0, 0, -0.055), (3.2, 2.0, 0.83), black_metal, 0.055)
body["description"] = "Reconstructed industrial test controller enclosure"
body["source_reference"] = "assets/equipment-cutout.png"
box("02 · Lid gasket seam", (0, 0, 0.36), (3.12, 1.94, 0.014), black, 0.008)
box("03 · Removable upper lid", (0, 0, 0.428), (3.12, 1.94, 0.136), lid_metal, 0.038)

# Front brushed-metal control panel and a narrow machined perimeter lip.
box("04 · Front control-panel substrate", (0, -0.997, -0.095), (3.115, 0.065, 0.64), panel_metal, 0.022)
box("05 · Front panel lower trim", (0, -1.034, -0.414), (3.02, 0.018, 0.018), black_metal, 0.007)
box("06 · Rear service panel", (0, 0.997, -0.08), (3.08, 0.045, 0.63), black_metal, 0.03)

# Six countersunk lid fasteners, each with a visible cross recess.
for index, (x, y) in enumerate(((-1.42, -0.79), (0, -0.79), (1.42, -0.79), (-1.42, 0.79), (0, 0.79), (1.42, 0.79)), 1):
    screw_top(f"Top lid fastener {index:02d}", x, y, 0.521, 0.047)

# Front fasteners sit at the four panel corners.
for index, (x, z) in enumerate(((-1.47, 0.15), (1.47, 0.15), (-1.47, -0.34), (1.47, -0.34)), 1):
    screw_front(f"Front panel fastener {index:02d}", x, z, -1.042, 0.045)

# Three circular industrial connectors, each with a deep well, turned rings,
# flange hardware and individually modelled plated contacts.
round_connector("Input RS-485", -1.12, -0.19, "ВХОД", font, "multi")
round_connector("Output RS-485", -0.50, -0.19, "ВЫХОД", font, "multi")
round_connector("Sensor inputs", 1.11, -0.19, "ДАТЧИКИ", font, "multi")
text_front("Input bus designation", "RS-485", (-1.12, -1.005, -0.37), 0.052, label_white, font)
text_front("Output bus designation", "RS-485", (-0.61, -1.005, -0.37), 0.052, label_white, font)
text_front("Sensor designation", "ВХОД 1-4", (1.11, -1.005, -0.37), 0.052, label_white, font)

# Recessed AC inlet with a bright metal bezel and three individual contacts.
text_front("Power input legend", "ПИТАНИЕ", (-0.04, -1.005, 0.185), 0.07, label_white, font)
box("AC socket steel bezel", (-0.04, -1.054, -0.18), (0.39, 0.055, 0.31), steel, 0.045)
box("AC inlet recessed well", (-0.04, -1.087, -0.18), (0.31, 0.025, 0.235), socket_black, 0.035)
box("AC inlet insert", (-0.04, -1.104, -0.18), (0.22, 0.012, 0.15), black, 0.024)
for index, dx in enumerate((-0.062, 0, 0.062), 1):
    box(f"AC inlet contact {index}", (-0.04 + dx, -1.113, -0.18), (0.018, 0.009, 0.078), steel, 0.006)
text_front("AC voltage marking", "~220 В 50 Гц", (-0.04, -1.005, -0.37), 0.048, label_white, font)

# DB-9 serial control connector with a metal shell, dark face and nine sockets.
text_front("Control port legend", "УПРАВЛЕНИЕ", (0.57, -1.005, 0.185), 0.067, label_white, font)
box("DB9 shell", (0.57, -1.055, -0.18), (0.50, 0.058, 0.265), nickel, 0.07)
box("DB9 black insert", (0.57, -1.091, -0.18), (0.414, 0.026, 0.18), socket_black, 0.052)
for index, dx in enumerate((-0.236, 0.236), 1):
    cylinder(f"DB9 jack screw {index}", (0.57 + dx, -1.097, -0.18), 0.033, 0.014, steel, vertices=24, bevel=0.004)
    box(f"DB9 jack slot {index}", (0.57 + dx, -1.106, -0.18), (0.028, 0.003, 0.004), slot, 0.001)
for row, count in ((0, 5), (1, 4)):
    for column in range(count):
        dx = (column - (count - 1) / 2) * 0.064
        dz = (0.025 if row == 0 else -0.025)
        cylinder(f"DB9 socket {row}-{column}", (0.57 + dx, -1.108, -0.18 + dz), 0.018, 0.008, steel, vertices=20, bevel=0.002)
        cylinder(f"DB9 socket center {row}-{column}", (0.57 + dx, -1.114, -0.18 + dz), 0.009, 0.006, socket_black, vertices=16)
text_front("DB9 standard marking", "RS-232", (0.57, -1.005, -0.37), 0.052, label_white, font)

# Recessed green power indicator with bezel and glass dome.
text_front("Indicator legend", "ПИТАНИЕ", (0.045, -1.005, 0.305), 0.061, label_white, font)
cylinder("LED bezel", (0.045, -1.055, 0.055), 0.052, 0.035, led_dark, vertices=40, bevel=0.009)
torus("LED nickel retaining ring", (0.045, -1.078, 0.055), 0.039, 0.006, nickel)
uv_sphere("Green indicator lens", (0.045, -1.085, 0.055), (0.032, 0.019, 0.032), led_green)

# Power rocker switch and bezel, with readable I / O markings.
text_front("Mains legend", "ПИТАНИЕ", (1.43, -1.005, 0.185), 0.052, label_white, font)
box("Rocker outer bezel", (1.43, -1.055, -0.11), (0.21, 0.075, 0.36), steel, 0.043)
box("Rocker recessed surround", (1.43, -1.1, -0.11), (0.17, 0.03, 0.30), black, 0.033)
rocker = box("Mains rocker switch", (1.43, -1.12, -0.11), (0.14, 0.042, 0.25), black_metal, 0.027, (math.radians(-6), 0, 0))
text_front("Rocker ON mark", "I", (1.43, -1.145, -0.043), 0.055, label_white, font)
text_front("Rocker OFF mark", "O", (1.43, -1.145, -0.177), 0.052, label_white, font)

# Rear wall: independently designed service face with ventilation, power,
# service connectors, a rating plate and perimeter fasteners.
box("Rear inset service face", (0, 1.024, -0.08), (2.92, 0.025, 0.49), panel_metal, 0.025)
for index, (x, z) in enumerate(((-1.39, 0.17), (1.39, 0.17), (-1.39, -0.31), (1.39, -0.31)), 1):
    cylinder(f"Rear fastener {index}", (x, 1.045, z), 0.041, 0.018, steel, vertices=40, bevel=0.004)
    box(f"Rear fastener slot {index}", (x, 1.057, z), (0.042, 0.003, 0.006), slot, 0.001)
for index in range(10):
    z = -0.25 + index * 0.042
    box(f"Rear exhaust grille slot {index + 1:02d}", (0.12, 1.044, z), (0.82, 0.012, 0.018), socket_black, 0.008)
for index, x in enumerate((-1.05, -0.62), 1):
    add_round_connector_on_back(f"Rear service connector {index}", x, -0.045)
box("Rear service rating label", (0.94, 1.043, -0.05), (0.57, 0.015, 0.30), black, 0.015)
text_back("Rear rating heading", "СПЕЦЭЛЕКТРОНИКА", (0.94, 1.055, 0.045), 0.043, label_white, font)
text_back("Rear rating line one", "БЛОК ИСПЫТАТЕЛЬНЫЙ", (0.94, 1.055, -0.035), 0.034, label_white, font)
text_back("Rear rating line two", "24 V · СЕРВИС", (0.94, 1.055, -0.105), 0.034, label_white, font)

# Ventilated side panels, four chassis screws per side and a lower edge seam.
# The photographed side wall is a plain uninterrupted panel; keep the opposite
# side equally restrained while the rear face carries the service vents.

# Four vibration-isolating feet and their small retaining washers.
for x in (-1.22, 1.22):
    for y in (-0.69, 0.69):
        cylinder("Rubber isolation foot", (x, y, -0.515), 0.115, 0.16, rubber, axis="Z", vertices=40, bevel=0.025)
        cylinder("Foot retaining washer", (x, y, -0.435), 0.071, 0.022, steel, axis="Z", vertices=40, bevel=0.006)

# Parent all product details to a centered root for clean web rotation.
root = bpy.data.objects.new("Testing unit · rotation root", None)
bpy.context.collection.objects.link(root)
root.empty_display_type = "CIRCLE"
root.empty_display_size = 0.22
root["note"] = "Rotate this root for the scroll-linked turntable animation."
for obj in list(bpy.context.scene.objects):
    if obj is root or obj.type in {"CAMERA", "LIGHT"}:
        continue
    obj.parent = root

# Render setup for a review image and for opening the .blend directly.
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = 48
scene.render.resolution_x = 1440
scene.render.resolution_y = 920
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.render.filepath = str(OUTPUT / "testing-equipment-preview.png")
scene.world.use_nodes = True
world_shader = scene.world.node_tree.nodes.get("Background")
world_shader.inputs["Color"].default_value = (0.003, 0.004, 0.006, 1)
world_shader.inputs["Strength"].default_value = 0.16
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"

def aim(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()

bpy.ops.object.camera_add(location=(-4.5, -7.4, 4.8))
camera = bpy.context.object
camera.name = "Review camera · front left three-quarter"
aim(camera, (0, 0, -0.04))
camera.data.type = "ORTHO"
camera.data.ortho_scale = 4.25
camera.data.lens = 55
scene.camera = camera

def area_light(name, location, energy, color, size, target=(0, 0, 0)):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.color = color
    light.data.shape = "DISK"
    light.data.size = size
    aim(light, target)

area_light("Key softbox - upper left", (-3.8, -4.4, 5.5), 110, (0.76, 0.84, 1.0), 4.2)
area_light("Front strip - connectors", (1.8, -4.0, 1.8), 230, (1.0, 0.77, 0.55), 3.2)
area_light("Rim light - rear edge", (2.8, 2.5, 4.0), 150, (0.68, 0.77, 1.0), 3.0)
area_light("Side fill", (-4.5, 0.2, 1.3), 115, (0.75, 0.8, 0.86), 2.5)

# Keep the product selected in the saved project and export the same geometry
# as an embeddable glTF binary for future website integration.
bpy.ops.object.select_all(action="DESELECT")
root.select_set(True)
bpy.context.view_layer.objects.active = root
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT / "testing-equipment.blend"))

scene.render.filepath = str(OUTPUT / "testing-equipment-preview.png")
bpy.ops.render.render(write_still=True)

# A second inspection angle verifies the custom-built rear panel and ports.
camera.location = (4.5, 7.4, 4.8)
aim(camera, (0, 0, -0.04))
scene.render.filepath = str(OUTPUT / "testing-equipment-rear-preview.png")
bpy.ops.render.render(write_still=True)

# The glTF exporter does not support Blender text curves, so convert only text
# objects after saving the editable .blend project.
text_objects = [obj for obj in bpy.context.scene.objects if obj.type == "FONT"]
bpy.ops.object.select_all(action="DESELECT")
for obj in text_objects:
    obj.select_set(True)
if text_objects:
    bpy.context.view_layer.objects.active = text_objects[0]
    bpy.ops.object.convert(target="MESH")

bpy.ops.object.select_all(action="DESELECT")
for obj in bpy.context.scene.objects:
    if obj.type not in {"CAMERA", "LIGHT"}:
        obj.select_set(True)
bpy.context.view_layer.objects.active = root
bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT / "testing-equipment.glb"),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_animations=False,
    export_materials="EXPORT",
)
print("Created Blender model, GLB export, and preview under", OUTPUT)
