from pathlib import Path
import json, struct
root=Path(__file__).resolve().parents[1]
p=root/'device-demo/device.glb'
b=p.read_bytes()
assert b[:4]==b'glTF'
n=struct.unpack_from('<I',b,12)[0]
g=json.loads(b[20:20+n])
materials={m['name'] for m in g['materials']}
assert {'Metal_Shiny','Metal_Brushed','Plastic_Matte','LED_Green'}<=materials
assert all('translation' not in x or x['translation']==[0,0,0] for x in g['nodes'])
assert not g.get('animations')
for mesh in g['meshes']:
    for primitive in mesh['primitives']:
        if g['materials'][primitive['material']]['name']=='Metal_Brushed':
            assert 'TEXCOORD_0' in primitive['attributes']
for name in ['studio.hdr','brushed_normal.jpg','vendor/three.module.js','vendor/GLTFLoader.js','vendor/RGBELoader.js','utils/BufferGeometryUtils.js','vendor/gsap.min.js','vendor/ScrollTrigger.min.js']:
    assert (p.parent/name).stat().st_size>0,name
print('PASS: GLB materials, centered origins, panel UVs, no baked animation, local dependencies')
