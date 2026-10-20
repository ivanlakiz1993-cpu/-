"""Reference reconstruction. Blender --background --python this_file.py [-- --draft].

One Blender unit represents 100 mm. Hidden rear details are an interpretation,
not a measured engineering specification. Previous model is preserved.
"""
from pathlib import Path
import math
import sys
import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'device-demo'
OUT.mkdir(parents=True, exist_ok=True)
DRAFT = '--draft' in sys.argv
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, color, metal=0, rough=.4, grain=None):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    n, l = m.node_tree.nodes, m.node_tree.links
    p = n.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    if grain:
        tc = n.new('ShaderNodeTexCoord')
        scale = n.new('ShaderNodeVectorMath')
        scale.operation = 'MULTIPLY'
        scale.inputs[1].default_value = grain
        l.new(tc.outputs['Object'], scale.inputs[0])
        noise = n.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 1
        noise.inputs['Detail'].default_value = 2
        l.new(scale.outputs['Vector'], noise.inputs['Vector'])
        bump = n.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .15
        bump.inputs['Distance'].default_value = .00065
        l.new(noise.outputs['Fac'], bump.inputs['Height'])
        l.new(bump.outputs['Normal'], p.inputs['Normal'])
        ramp = n.new('ShaderNodeMapRange')
        ramp.inputs['To Min'].default_value = rough - .035
        ramp.inputs['To Max'].default_value = rough + .035
        l.new(noise.outputs['Fac'], ramp.inputs['Value'])
        l.new(ramp.outputs['Result'], p.inputs['Roughness'])
    return m


lidmat = material('01 - Satin graphite powder coat / microtexture', (.025,.025,.027), .18,.48,(190,190,190))
bodymat = material('02 - Black anodized side walls', (.009,.009,.01), .35,.48,(75,75,160))
panelmat = material('03 - Horizontal brushed black aluminium', (.009,.009,.01), .48,.48,(8,20,1100))
steel = material('04 - Satin stainless steel', (.34,.33,.31), .88,.29,(230,230,230))
nickel = material('05 - Machined nickel connector shells', (.42,.40,.37), .92,.25,(260,260,260))
gold = material('06 • Gold-plated brass contacts', (.63,.37,.12), .92,.23)
polymer = material('07 • Black moulded connector polymer', (.005,.005,.006), .05,.29,(190,190,190))
dark = material('08 • Deep socket recesses', (.001,.001,.001), 0,.65)
rubber = material('09 • EPDM gasket and feet', (.006,.006,.006), 0,.69)
ink = material('10 • Warm white screen print', (.78,.78,.75), 0,.46)
green = material('11 • Green indicator lens', (.008,.32,.025), .05,.16)
g = green.node_tree.nodes.get('Principled BSDF')
g.inputs['Emission Color'].default_value = (.005,.3,.012,1)
g.inputs['Emission Strength'].default_value = 1.2
g.inputs['Coat Weight'].default_value = .65


def finish(o, mat, bevel=0):
    if mat:
        o.data.materials.append(mat)
    if bevel:
        b = o.modifiers.new('Precision edge fillets', 'BEVEL')
        b.width, b.segments = bevel, 4
    if o.type == 'MESH':
        w = o.modifiers.new('Weighted machined normals', 'WEIGHTED_NORMAL')
        w.keep_sharp = True
    return o


def box(name, loc, size, mat, bevel=.01):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, mat, bevel)


def cyl(name, loc, radius, depth, mat, axis='Y', verts=96, bevel=.002):
    rot = (math.pi/2,0,0) if axis == 'Y' else (0,0,0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    for p in o.data.polygons:
        p.use_smooth = len(p.vertices)==4
    return finish(o, mat, bevel)


def profile(name, points, y, depth, mat, bevel=.008):
    # An extruded XZ contour. Front is negative Y.
    n = len(points)
    vs = [(x,y+d,z) for d in (-depth/2,depth/2) for x,z in points]
    faces = [tuple(range(n-1,-1,-1)), tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vs,[],faces)
    mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(o)
    return finish(o,mat,bevel)


def tube(name,x,z,sections,mat,segments=128):
    # Closed lathed section: (Y, radius), including return path on inner bore.
    vs = [(x+r*math.cos(i*math.tau/segments),y,z+r*math.sin(i*math.tau/segments))
          for y,r in sections for i in range(segments)]
    faces = []
    for j in range(len(sections)):
        for i in range(segments):
            a=j*segments+i; b=j*segments+(i+1)%segments
            c=((j+1)%len(sections))*segments+(i+1)%segments
            d=((j+1)%len(sections))*segments+i
            faces.append((a,b,c,d))
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(vs,[],faces); mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    for p in mesh.polygons: p.use_smooth=True
    return o


def path(name, coords, radius, mat):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'
    c.bevel_depth=radius; c.bevel_resolution=3; c.resolution_u=1
    s=c.splines.new('POLY'); s.points.add(len(coords)-1)
    for p,v in zip(s.points,coords): p.co=(*v,1)
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    return o


def cut(o,cutter):
    bpy.context.view_layer.objects.active=o
    b=o.modifiers.new('Physical recess / machined opening','BOOLEAN')
    b.operation='DIFFERENCE'; b.object=cutter
    # Apply cuts before finishing bevels.
    bpy.ops.object.modifier_move_up(modifier=b.name)
    bpy.ops.object.modifier_move_up(modifier=b.name)
    bpy.ops.object.modifier_apply(modifier=b.name)
    bpy.data.objects.remove(cutter,do_unlink=True)


fontpath=Path('C:/Windows/Fonts/arial.ttf')
font=bpy.data.fonts.load(str(fontpath)) if fontpath.exists() else None
def text(name,body,x,y,z,size=.066,back=False):
    c=bpy.data.curves.new(name,'FONT'); c.body=body; c.size=size
    c.align_x='CENTER'; c.align_y='CENTER'; c.extrude=.00012
    c.space_character=1.02
    if font: c.font=font
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o)
    o.location=(x,y,z)
    o.rotation_euler=(math.pi/2,0,math.pi) if back else (math.pi/2,0,0)
    c.materials.append(ink)
    return o


def screw(name,x,y,z,top=False,r=.051):
    axis='Z' if top else 'Y'
    cyl(name+' countersink',(x,y,z),r*1.14,.012,dark,axis)
    loc=(x,y,z+.004) if top else (x,y-.004,z)
    head=cyl(name+' stainless head',loc,r,.016,steel,axis,64,.003)
    # Actual cross-shaped recessed drive, not a painted cross.
    for a in range(2):
        if top:
            dims=(r*1.18,r*.23,.026) if a==0 else (r*.23,r*1.18,.026)
            pos=(x,y,z+.014)
        else:
            dims=(r*1.18,.026,r*.23) if a==0 else (r*.23,.026,r*1.18)
            pos=(x,y-.014,z)
        cut(head,box(name+' drive cutter',pos,dims,None,0))
    return head


# Hollow enclosure, thin removable lid and restrained unvented side walls.
box('01 Chassis base',(0,0,.035),(4.8,2.65,.07),bodymat,.035)
for side in (-1,1):
    box('02 Smooth side wall '+str(side),(side*2.365,0,.54),(.07,2.65,1.02),bodymat,.027)
rear=box('03 Rear removable service panel',(0,1.305,.54),(4.7,.06,1.02),panelmat,.025)
front=box('04 Front control panel',(0,-1.335,.54),(4.73,.055,1.02),panelmat,.025)
box('05 Lid seam / EPDM gasket',(0,0,1.055),(4.78,2.63,.016),rubber,.025)
lid=box('06 Thin satin lid',(0,0,1.096),(4.8,2.65,.072),lidmat,.032)
for i,x in enumerate((-2.25,0,2.25)):
    for j,y in enumerate((-1.17,1.17)):
        screw(f'Lid M3 countersunk {i}-{j}',x,y,1.135,True,.052)
for x in (-2.25,2.25):
    for z in (.12,.96): screw('Panel M3 corner',x,-1.369,z,False,.05)


def connector(name,x,label,bottom):
    z=.435
    cut(front,cyl(name+' panel cutout',(x,-1.335,z),.173,.2,None,bevel=0))
    # Chamfered hexagonal panel nut and circular sealing washer.
    cyl(name+' sealing washer',(x,-1.381,z),.232,.021,rubber)
    nut=cyl(name+' hex mounting nut',(x,-1.408,z),.241,.054,nickel,verts=6,bevel=.009)
    cut(nut,cyl(name+' nut bore',(x,-1.408,z),.173,.14,None,bevel=0))
    tube(name+' hollow turned shell',x,z,[(-1.39,.185),(-1.44,.203),(-1.58,.203),(-1.603,.197),(-1.603,.173),(-1.43,.173)],nickel)
    tube(name+' polished mouth lip',x,z,[(-1.578,.202),(-1.609,.202),(-1.616,.194),(-1.616,.175),(-1.604,.171),(-1.578,.171)],steel)
    # Continuous helical external thread, with a real pitch and flank profile.
    coords=[]
    for i in range(128*7+1):
        t=i/(128*7); a=t*math.tau*7
        coords.append((x+.205*math.cos(a),-1.443-.128*t,z+.205*math.sin(a)))
    path(name+' continuous M-thread',coords,.0043,nickel)
    cyl(name+' recessed insulating carrier',(x,-1.448,z),.171,.027,polymer)
    for j in range(7):
        a=j*math.tau/6+math.pi/6
        dx,dz=(0,0) if j==6 else (.101*math.cos(a),.101*math.sin(a))
        cyl(name+f' gold contact {j+1}',(x+dx,-1.5,z+dz),.012,.075,gold,verts=24,bevel=.004)
    box(name+' orientation key',(x,-1.584,z+.166),(.032,.045,.018),nickel,.004)
    text(name+' top legend',label,x,-1.367,.805,.073)
    text(name+' lower legend',bottom,x,-1.367,.105,.066)


connector('Input RS485',-1.78,'\u0412\u0425\u041e\u0414','RS-485')
connector('Output RS485',-.98,'\u0412\u042b\u0425\u041e\u0414','RS-485')
connector('Sensor port',1.51,'\u0414\u0410\u0422\u0427\u0418\u041a\u0418','\u0412\u0425\u041e\u0414 1-4')

# IEC C14 inlet with three exposed, bevelled metal blades in the cavity.
acx=-.20; acz=.425
shape=[(-.245,-.135),(.245,-.135),(.245,.065),(.16,.15),(-.16,.15),(-.245,.065)]
pts=[(acx+x,acz+z) for x,z in shape]
cut(front,profile('IEC panel opening',pts,-1.335,.2,None,0))
iec=profile('IEC moulded flange',[(acx+x,acz+z) for x,z in [(-.36,-.09),(-.25,-.18),(.25,-.18),(.36,-.09),(.36,.08),(.24,.18),(-.24,.18),(-.36,.08)]],-1.397,.06,polymer,.025)
cut(iec,profile('IEC flange aperture',pts,-1.397,.14,None,.012))
shell=profile('IEC bevelled socket housing',[(acx+x*1.11,acz+z*1.13) for x,z in shape],-1.445,.12,polymer,.012)
cut(shell,profile('IEC internal aperture',pts,-1.47,.18,None,.008))
profile('IEC deep back wall',pts,-1.365,.018,dark,.005)
for index,(x,z,width,height) in enumerate([
    (-.103,-.015,.045,.072),
    (.103,-.015,.045,.072),
    (0,.075,.052,.082),
], start=1):
    # The blade face points toward the viewer (-Y); each blade reaches 12.5 mm
    # beyond the socket lip and is a separate mesh/material in the exported GLB.
    box(f'IEC exposed metal blade {index}',(acx+x,-1.552,acz+z),(width,.155,height),steel,.006)
for dx in (-.306,.306): screw('IEC flange fastener',acx+dx,-1.437,acz,False,.033)
text('Mains supply rating','~220 \u0412  50 \u0413\u0446',acx,-1.367,.105,.066)
text('Indicator legend','\u041f\u0418\u0422\u0410\u041d\u0418\u0415',acx,-1.367,.84,.073)
cyl('LED black retaining bezel',(acx,-1.389,.775),.055,.036,polymer)
tube('LED polished rim',acx,.775,[(-1.402,.045),(-1.416,.045),(-1.416,.039),(-1.402,.039)],nickel,64)
bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=24,location=(acx,-1.416,.775))
led=bpy.context.object; led.name='Power green domed glass'; led.scale=(.039,.024,.039)
led.data.materials.append(green)
for p in led.data.polygons:p.use_smooth=True

# D-sub female DB9: trapezoidal metal can, inset polymer and 5 + 4 sockets.
dbx=.70; dbz=.435
dshape=[(-.235,-.115),(.235,-.115),(.285,.09),(.255,.13),(-.255,.13),(-.285,.09)]
outer=[(dbx+x,dbz+z) for x,z in dshape]
cut(front,profile('DB9 panel aperture',outer,-1.335,.2,None,0))
profile('DB9 mounting flange',[(dbx+x,dbz+z) for x,z in [(-.39,-.14),(.39,-.14),(.39,.14),(-.39,.14)]],-1.384,.035,nickel,.04)
dshell=profile('DB9 drawn stainless shell',outer,-1.461,.132,nickel,.019)
cut(dshell,profile('DB9 shell cavity',[(dbx+x*.92,dbz+z*.82) for x,z in dshape],-1.49,.17,None,.01))
profile('DB9 black insulating face',[(dbx+x*.84,dbz+z*.72) for x,z in dshape],-1.514,.018,polymer,.012)
for row,count in enumerate((5,4)):
    for j in range(count):
        x=dbx+(j-(count-1)/2)*.087; z=dbz+(.052 if row==0 else -.043)
        tube(f'DB9 female contact lip {row}-{j}',x,z,[(-1.526,.019),(-1.53,.019),(-1.53,.014),(-1.526,.014)],steel,32)
        cyl(f'DB9 recessed socket {row}-{j}',(x,-1.53,z),.014,.005,dark,verts=32,bevel=0)
for dx in (-.347,.347):
    jack=cyl('DB9 hex threaded standoff',(dbx+dx,-1.457,dbz),.053,.125,nickel,verts=6,bevel=.004)
    cut(jack,cyl('DB9 threaded bore',(dbx+dx,-1.51,dbz),.028,.13,None,bevel=0))
    cyl('DB9 bore shadow',(dbx+dx,-1.423,dbz),.028,.008,dark)
text('DB9 top legend','\u0423\u041f\u0420\u0410\u0412\u041b\u0415\u041d\u0418\u0415',dbx,-1.367,.805,.07)
text('DB9 standard','RS-232',dbx,-1.367,.105,.066)

# Black rocker switch. Curved face and slightly tilted actuator.
sx=2.08
box('Rocker black moulded bezel',(sx,-1.40,.54),(.30,.085,.45),polymer,.026)
box('Rocker perimeter recess',(sx,-1.452,.54),(.225,.024,.36),dark,.012)
rocker=box('Rocker actuator',(sx,-1.474,.54),(.205,.055,.33),bodymat,.018)
rocker.rotation_euler.x=math.radians(-9)
text('Rocker I','I',sx,-1.496,.645,.069)
text('Rocker O','O',sx,-1.524,.445,.066)
text('Switch power label','\u041f\u0418\u0422\u0410\u041d\u0418\u0415',sx,-1.367,.805,.07)

# Rear interpretation: clean sealed removable panel, fixing screws, service
# plate and earth stud. No invented extra signal ports or ventilation openings.
for x in (-2.23,2.23):
    for z in (.13,.95):
        cyl('Rear countersunk fastener',(x,1.345,z),.05,.015,steel)
        box('Rear cross drive A',(x,1.354,z),(.058,.004,.012),dark,.002)
        box('Rear cross drive B',(x,1.354,z),(.012,.004,.058),dark,.002)
box('Rear identification plaque',(0,1.342,.53),(1.30,.013,.32),polymer,.012)
text('Rear company','\u0421\u041f\u0415\u0426\u042d\u041b\u0415\u041a\u0422\u0420\u041e\u041d\u0418\u041a\u0410',0,1.352,.61,.065,True)
text('Rear unit','\u0411\u041b\u041e\u041a \u0423\u041f\u0420\u0410\u0412\u041b\u0415\u041d\u0418\u042f',0,1.352,.52,.045,True)
text('Rear rating','~220 \u0412  50 \u0413\u0446',0,1.352,.445,.04,True)
cyl('Rear protective-earth washer',(-1.76,1.35,.27),.058,.019,steel)
cyl('Rear protective-earth stud',(-1.76,1.38,.27),.026,.06,nickel,verts=6)
text('Rear earth marking','PE',-1.76,1.353,.405,.05,True)
for x in (-1.95,1.95):
    for y in (-.95,.95):
        cyl('Low EPDM isolation foot',(x,y,-.022),.105,.066,rubber,'Z',64,.012)


# Portable PBR materials: replace Blender-only procedural nodes before export.
plastic = material('Plastic_Matte', (.018,.019,.021), 0, .6)
metal = material('Metal_Shiny', (.73,.73,.73), 1, .12)
gold_metal = material('Metal_Gold', (.64,.38,.09), 1, .2)
power_pin_metal = material('Metal_Power_Pin', (.73,.73,.73), 1, .1)
brushed = material('Metal_Brushed', (.025,.027,.03), 1, .4)
ledmat = material('LED_Green', (0,1,.055), 0, .2)
# Deterministic tangent-space horizontal brushing, saved alongside the GLB.
import numpy as np
rng = np.random.default_rng(27)
w = h = 1024
rows = rng.normal(0, .13, (h,1))
pixels = np.ones((h,w,4), dtype=np.float32)
pixels[:,:,0] = .5
pixels[:,:,1] = np.clip(.5 + rows + rng.normal(0,.008,(h,w)), .1,.9)
pixels[:,:,2] = np.sqrt(np.maximum(0,1-(pixels[:,:,1]*2-1)**2))*.5+.5
im = bpy.data.images.new('Brushed tangent normals', width=w,height=h)
im.colorspace_settings.name='Non-Color'
im.pixels.foreach_set(pixels.ravel())
im.filepath_raw=str(OUT/'brushed_normal.jpg'); im.file_format='JPEG'; im.save()
# Original procedural studio HDR, no external runtime dependency.
w,h=1024,512
u,v=np.meshgrid(np.arange(w)/w,np.arange(h)/h)
radiance=np.full((h,w),.045)
for cx,cy,sx,sy,power in [(.18,.36,.045,.14,7),(.68,.3,.09,.08,5),(.94,.46,.025,.20,4)]:
    dx=np.minimum(abs(u-cx),1-abs(u-cx))
    radiance += power*np.exp(-((dx/sx)**8+((v-cy)/sy)**8))
pixels=np.ones((h,w,4),dtype=np.float32)
pixels[:,:,:3]=radiance[:,:,None]
hdr=bpy.data.images.new('Studio softboxes',width=w,height=h,float_buffer=True)
hdr.pixels.foreach_set(pixels.ravel()); hdr.filepath_raw=str(OUT/'studio.hdr'); hdr.file_format='HDR'; hdr.save()
for obj in list(bpy.context.scene.objects):
    if obj.type not in {'MESH','CURVE','FONT'}: continue
    old=obj.data.materials[0] if obj.data.materials else None
    if 'IEC exposed metal blade' in obj.name:
        new=power_pin_metal; prefix='Metal_power_pin_'
    elif old == gold: new=gold_metal; prefix='Metal_'
    elif old in (steel,nickel): new=metal; prefix='Metal_'
    elif old==panelmat: new=brushed; prefix='Panel_'
    elif old==green: new=ledmat; prefix='LED_'
    elif old==ink: new=ink; prefix='Label_'
    else: new=plastic; prefix='Plastic_'
    obj.data.materials.clear(); obj.data.materials.append(new); obj.name=prefix+obj.name
    obj.location.z -= .54
# Bake every object's location/rotation/scale into its mesh, then combine all
# metal parts (including IEC blades) so they share one stable parent transform.
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active=front
bpy.ops.object.convert(target='MESH')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active=None
for obj in bpy.context.scene.objects:
    if obj.name.startswith('Metal_'): obj.select_set(True)
bpy.context.view_layer.objects.active=next(o for o in bpy.context.scene.objects if o.select_get())
bpy.ops.object.join(); bpy.context.object.name='Metal_Connectors_Screws_Pins'
bpy.context.scene.cursor.location=(0,0,0)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
root=bpy.data.objects.new('Device',None); bpy.context.collection.objects.link(root)
for obj in list(bpy.context.scene.objects):
    if obj!=root: obj.parent=root
root['dimensions']='Visual reconstruction, not measured engineering dimensions'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'device.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'device.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False)
print('DEVICE COMPLETE:', OUT)
