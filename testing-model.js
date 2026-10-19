// Local GLB viewer for the shared test unit, including its surface weather.
(() => {
  const canvas = document.querySelector('[data-testing-model]');
  const equipment = document.querySelector('[data-testing-equipment]');
  if (!canvas || !equipment) return;

  const modelUrl = 'assets/models/reference-v2/testing-equipment-reference.glb';
  const clampPixelRatio = () => Math.min(window.devicePixelRatio || 1, 1.5);
  let weather = { wetness: 0, frostProgress: 0, time: 0 };
  let drawWeatheredModel = null;
  window.updateTestingModelWeather = next => {
    weather = { ...weather, ...next };
    drawWeatheredModel?.();
  };
  const vector = {
    normalize(v) {
      const length = Math.hypot(v[0], v[1], v[2]) || 1;
      return v.map(value => value / length);
    },
    cross(a, b) {
      return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    },
    dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  };

  const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const multiplyMatrix = (a, b) => {
    const out = new Float32Array(16);
    for (let column = 0; column < 4; column++) {
      for (let row = 0; row < 4; row++) {
        out[column * 4 + row] = a[row] * b[column * 4] + a[4 + row] * b[column * 4 + 1] +
          a[8 + row] * b[column * 4 + 2] + a[12 + row] * b[column * 4 + 3];
      }
    }
    return out;
  };
  const nodeMatrix = node => {
    if (node.matrix) return new Float32Array(node.matrix);
    const [x, y, z, w] = node.rotation || [0, 0, 0, 1];
    const [sx, sy, sz] = node.scale || [1, 1, 1];
    const [tx, ty, tz] = node.translation || [0, 0, 0];
    const xx = x * x, yy = y * y, zz = z * z;
    const xy = x * y, xz = x * z, yz = y * z;
    const wx = w * x, wy = w * y, wz = w * z;
    return new Float32Array([
      (1 - 2 * (yy + zz)) * sx, (2 * (xy + wz)) * sx, (2 * (xz - wy)) * sx, 0,
      (2 * (xy - wz)) * sy, (1 - 2 * (xx + zz)) * sy, (2 * (yz + wx)) * sy, 0,
      (2 * (xz + wy)) * sz, (2 * (yz - wx)) * sz, (1 - 2 * (xx + yy)) * sz, 0,
      tx, ty, tz, 1
    ]);
  };
  const transformPoint = (m, p) => [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]
  ];
  const normalMatrix = m => {
    const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], i = m[10];
    const A = e * i - f * h, B = f * g - d * i, C = d * h - e * g;
    const determinant = a * A + b * B + c * C || 1;
    return [A / determinant, B / determinant, C / determinant,
      (c * h - b * i) / determinant, (a * i - c * g) / determinant, (b * g - a * h) / determinant,
      (b * f - c * e) / determinant, (c * d - a * f) / determinant, (a * e - b * d) / determinant];
  };
  const transformNormal = (m, n) => vector.normalize([
    m[0] * n[0] + m[1] * n[1] + m[2] * n[2],
    m[3] * n[0] + m[4] * n[1] + m[5] * n[2],
    m[6] * n[0] + m[7] * n[1] + m[8] * n[2]
  ]);

  const readGlb = async url => {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Could not load equipment model (${response.status})`);
    const file = await response.arrayBuffer();
    const header = new DataView(file);
    if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2) {
      throw new Error('Unsupported GLB header');
    }
    let offset = 12;
    let json;
    let binary;
    while (offset < file.byteLength) {
      const length = header.getUint32(offset, true);
      const type = header.getUint32(offset + 4, true);
      offset += 8;
      if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(file.slice(offset, offset + length)).trim());
      if (type === 0x004e4942) binary = file.slice(offset, offset + length);
      offset += length;
    }
    if (!json || !binary) throw new Error('The GLB has no JSON or binary chunk');
    return { json, binary };
  };

  const componentInfo = {
    5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2],
    5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4]
  };
  const componentCount = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const readAccessor = (gltf, binary, accessorIndex) => {
    const accessor = gltf.accessors[accessorIndex];
    const view = gltf.bufferViews[accessor.bufferView];
    const [ArrayType, componentBytes] = componentInfo[accessor.componentType];
    const size = componentCount[accessor.type];
    const stride = view.byteStride || componentBytes * size;
    const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
    const result = new ArrayType(accessor.count * size);
    const source = new DataView(binary);
    const getter = ({5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32'})[accessor.componentType];
    for (let item = 0; item < accessor.count; item++) {
      for (let part = 0; part < size; part++) {
        result[item * size + part] = source[getter](start + item * stride + part * componentBytes, true);
      }
    }
    return { values: result, size, count: accessor.count };
  };

  const unpackModel = ({ json, binary }) => {
    const materials = (json.materials || []).map(material => {
      const pbr = material.pbrMetallicRoughness || {};
      const name = (material.name || '').toLowerCase();
      let metallic = pbr.metallicFactor ?? 1;
      let roughness = pbr.roughnessFactor ?? 0.68;
      if (name.includes('black anodized side walls')) { metallic = 0.7; roughness = 0.31; }
      if (name.includes('brushed black aluminium')) { metallic = 0.82; roughness = 0.27; }
      if (name.includes('satin graphite powder coat')) { metallic = 0.32; roughness = 0.38; }
      if (name.includes('black moulded connector polymer')) { metallic = 0.08; roughness = 0.37; }
      if (name.includes('machined nickel connector shells')) { metallic = 0.98; roughness = 0.2; }
      if (name.includes('satin stainless steel')) { metallic = 0.94; roughness = 0.24; }
      return {
        name: material.name || '',
        color: pbr.baseColorFactor || [1, 1, 1, 1],
        metallic,
        roughness,
        emissive: material.emissiveFactor || [0, 0, 0],
        doubleSided: !!material.doubleSided
      };
    });
    const buckets = new Map();
    const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    const appendPrimitive = (primitive, world) => {
      if ((primitive.mode ?? 4) !== 4) return;
      const attributes = primitive.attributes;
      const positions = readAccessor(json, binary, attributes.POSITION);
      const normals = attributes.NORMAL === undefined ? null : readAccessor(json, binary, attributes.NORMAL);
      const indices = primitive.indices === undefined
        ? Array.from({ length: positions.count }, (_, i) => i)
        : readAccessor(json, binary, primitive.indices).values;
      const normalTransform = normalMatrix(world);
      const materialIndex = primitive.material ?? -1;
      let bucket = buckets.get(materialIndex);
      if (!bucket) { bucket = { positions: [], normals: [] }; buckets.set(materialIndex, bucket); }
      for (let triangle = 0; triangle + 2 < indices.length; triangle += 3) {
        const ids = [indices[triangle], indices[triangle + 1], indices[triangle + 2]];
        const points = ids.map(index => transformPoint(world, positions.values.subarray(index * 3, index * 3 + 3)));
        points.forEach(point => point.forEach((value, axis) => {
          bounds.min[axis] = Math.min(bounds.min[axis], value);
          bounds.max[axis] = Math.max(bounds.max[axis], value);
        }));
        let faceNormal;
        if (!normals) {
          const u = points[1].map((value, axis) => value - points[0][axis]);
          const v = points[2].map((value, axis) => value - points[0][axis]);
          faceNormal = vector.normalize(vector.cross(u, v));
        }
        ids.forEach((index, vertex) => {
          bucket.positions.push(...points[vertex]);
          const n = normals ? normals.values.subarray(index * 3, index * 3 + 3) : faceNormal;
          bucket.normals.push(...(normals ? transformNormal(normalTransform, n) : n));
        });
      }
    };
    const visit = (nodeIndex, parentMatrix) => {
      const node = json.nodes[nodeIndex];
      const world = multiplyMatrix(parentMatrix, nodeMatrix(node));
      if (node.mesh !== undefined) json.meshes[node.mesh].primitives.forEach(primitive => appendPrimitive(primitive, world));
      (node.children || []).forEach(child => visit(child, world));
    };
    (json.scenes?.[json.scene || 0]?.nodes || []).forEach(node => visit(node, identity()));
    return { materials, buckets, bounds };
  };

  const shaderSources = {
    vertex: `
      attribute vec3 a_position;
      attribute vec3 a_normal;
      uniform mat4 u_viewProjection;
      varying vec3 v_position;
      varying vec3 v_normal;
      void main() {
        v_position = a_position;
        v_normal = normalize(a_normal);
        gl_Position = u_viewProjection * vec4(a_position, 1.0);
      }
    `,
    fragment: `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
      #else
        precision mediump float;
      #endif
      uniform vec4 u_color;
      uniform float u_metallic;
      uniform float u_roughness;
      uniform vec3 u_emissive;
      uniform vec3 u_eye;
      uniform sampler2D u_texture;
      uniform float u_textureScale;
      uniform float u_textureAmount;
      uniform float u_wetness;
      uniform float u_frostProgress;
      uniform float u_time;
      varying vec3 v_position;
      varying vec3 v_normal;
      float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x);
        float b = mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x);
        return mix(a, b, f.y);
      }
      void main() {
        vec3 n = normalize(v_normal);
        vec3 v = normalize(u_eye - v_position);
        vec3 weights = pow(abs(n), vec3(5.0));
        weights /= max(weights.x + weights.y + weights.z, 0.0001);
        vec3 textureX = texture2D(u_texture, v_position.zy * u_textureScale).rgb;
        vec3 textureY = texture2D(u_texture, v_position.xz * u_textureScale).rgb;
        vec3 textureZ = texture2D(u_texture, v_position.xy * u_textureScale).rgb;
        vec3 mapped = textureX * weights.x + textureY * weights.y + textureZ * weights.z;
        float grain = dot(mapped, vec3(0.2126, 0.7152, 0.0722));
        float textureValue = mix(1.0, grain, u_textureAmount);
        vec3 l1 = normalize(vec3(-0.45, 0.82, 0.94));
        vec3 l2 = normalize(vec3(0.78, 0.55, 0.36));
        vec3 l3 = normalize(vec3(-0.55, 0.42, -0.72));
        float diffuse = max(dot(n, l1), 0.0) * 0.75 + max(dot(n, l2), 0.0) * 0.42 + max(dot(n, l3), 0.0) * 0.18;
        float roughness = clamp(u_roughness + (1.0 - grain) * u_textureAmount * 0.12, 0.0, 1.0);
        float exponent = mix(112.0, 8.0, roughness);
        vec3 h1 = normalize(l1 + v);
        vec3 h2 = normalize(l2 + v);
        float specular = pow(max(dot(n, h1), 0.0), exponent) * 0.78 + pow(max(dot(n, h2), 0.0), exponent * 0.7) * 0.38;
        float dielectric = 1.0 - u_metallic;
        vec3 base = u_color.rgb * textureValue;
        vec3 lit = base * (0.12 + diffuse * 0.62) * (0.28 + dielectric * 0.72);
        lit += base * specular * (0.08 + u_metallic * 1.22);
        lit += vec3(specular * (0.04 + u_metallic * 0.34));
        vec3 reflected = reflect(-v, n);
        float boxPower = mix(5.0, 22.0, 1.0 - roughness);
        float softboxA = pow(max(dot(reflected, normalize(vec3(-0.62, 0.74, 0.28))), 0.0), boxPower);
        float softboxB = pow(max(dot(reflected, normalize(vec3(0.58, 0.24, -0.78))), 0.0), boxPower * 0.72);
        float softboxC = pow(max(dot(reflected, normalize(vec3(0.12, 0.96, 0.25))), 0.0), boxPower * 0.9);
        float fresnel = pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 metalF0 = mix(vec3(0.04), base, u_metallic);
        vec3 environment = vec3(0.78, 0.83, 0.9) * softboxA * 0.68 +
          vec3(0.34, 0.4, 0.48) * softboxB * 0.36 + vec3(0.55, 0.58, 0.62) * softboxC * 0.48;
        lit += environment * (metalF0 + (vec3(1.0) - metalF0) * fresnel) * (0.5 + u_metallic * 1.05);
        lit += u_emissive;

        // Water beads are shaded on the actual top surface of the GLB.
        float topFace = smoothstep(0.72, 0.97, n.y);
        if (u_wetness > 0.001 && topFace > 0.001) {
          vec2 dropGrid = v_position.xz * vec2(4.0, 3.2);
          dropGrid.y += sin(u_time * 0.45 + dropGrid.x * 2.3) * 0.025;
          vec2 dropCell = floor(dropGrid);
          vec2 dropRandom = vec2(hash21(dropCell), hash21(dropCell + vec2(19.73, 19.73)));
          vec2 dropCenter = vec2(0.2) + dropRandom * 0.6;
          vec2 dropRadius = vec2(0.15, 0.19) * (0.78 + dropRandom.y * 0.58);
          vec2 dropCoord = (fract(dropGrid) - dropCenter) / dropRadius;
          float dropDistance = length(dropCoord);
          float dropMask = (1.0 - smoothstep(0.82, 1.0, dropDistance)) * step(0.27, dropRandom.x);
          float dropAmount = dropMask * topFace * u_wetness;
          float dome = sqrt(max(0.0, 1.0 - dot(dropCoord, dropCoord)));
          vec3 dropNormal = normalize(vec3(dropCoord.x * 0.72, dome, dropCoord.y * 0.72));
          vec3 dropHalf = normalize(dropNormal + normalize(vec3(-0.45, 0.82, 0.94)));
          float dropSpecular = pow(max(dot(dropNormal, dropHalf), 0.0), 48.0);
          float dropGlint = pow(max(dot(dropNormal, normalize(vec3(-0.5, 0.82, 0.3))), 0.0), 58.0);
          lit = mix(lit, lit * 0.54 + base * 0.1, dropAmount * 0.78);
          lit += dropAmount * (vec3(0.42, 0.48, 0.53) * dropSpecular * 0.72 + vec3(0.9) * dropGlint * 0.66);
        }

        // Frost grows from scattered nuclei with a noisy, irregular boundary.
        if (u_frostProgress > 0.001) {
          vec3 frostP = v_position;
          float seedA = length((frostP - vec3(-1.72, 1.08, 0.78)) * vec3(0.78, 0.9, 0.82));
          float seedB = length((frostP - vec3(1.62, 1.08, -0.62)) * vec3(0.82, 0.88, 0.9));
          float seedC = length((frostP - vec3(0.05, 1.08, 0.12)) * vec3(0.78, 0.92, 0.78));
          float frostDistance = min(seedA, min(seedB, seedC));
          vec2 frostCoord = abs(n.y) > abs(n.x) ? (abs(n.y) > abs(n.z) ? v_position.xz : v_position.xy) : (abs(n.x) > abs(n.z) ? v_position.zy : v_position.xy);
          float frostWarp = (noise2(frostCoord * 4.2) - 0.5) * 0.42 + (grain - 0.5) * 0.16;
          float frostRadius = u_frostProgress * 3.6;
          float frostMask = (1.0 - smoothstep(frostRadius - 0.08, frostRadius + 0.16, frostDistance + frostWarp)) * smoothstep(0.025, 0.11, u_frostProgress);
          float frostGrain = mix(grain, hash21(floor(frostCoord * vec2(28.0, 23.0))), 0.58);
          vec3 ice = mix(base, vec3(0.48, 0.54, 0.61), 0.72 + frostGrain * 0.12);
          lit = mix(lit, ice * (0.28 + diffuse * 0.72), frostMask * 0.84);
          lit += frostMask * smoothstep(0.7, 0.92, frostGrain) * vec3(0.16, 0.18, 0.2);
        }
        lit = pow(max(lit, vec3(0.0)), vec3(1.0 / 2.2));
        gl_FragColor = vec4(lit, u_color.a);
      }
    `
  };

  const compileShader = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Shader compile failed');
    return shader;
  };
  const createProgram = gl => {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, shaderSources.vertex));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, shaderSources.fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Shader link failed');
    return program;
  };

  const viewProjection = (aspect, bounds) => {
    const center = bounds.min.map((value, axis) => (value + bounds.max[axis]) * 0.5);
    // A milder azimuth shows more of the connector face and stops this
    // orthogonal enclosure from reading as a tapered wedge.
    const eye = center.map((value, axis) => value + [-2.7, 6.5, 12][axis]);
    const forward = vector.normalize(center.map((value, i) => value - eye[i]));
    const right = vector.normalize(vector.cross(forward, [0, 1, 0]));
    const up = vector.cross(right, forward);
    const view = new Float32Array([
      right[0], up[0], -forward[0], 0,
      right[1], up[1], -forward[1], 0,
      right[2], up[2], -forward[2], 0,
      -vector.dot(right, eye), -vector.dot(up, eye), vector.dot(forward, eye), 1
    ]);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const x of [bounds.min[0], bounds.max[0]]) {
      for (const y of [bounds.min[1], bounds.max[1]]) {
        for (const z of [bounds.min[2], bounds.max[2]]) {
          const relative = [x - center[0], y - center[1], z - center[2]];
          const projectedX = vector.dot(right, relative);
          const projectedY = vector.dot(up, relative);
          minX = Math.min(minX, projectedX); maxX = Math.max(maxX, projectedX);
          minY = Math.min(minY, projectedY); maxY = Math.max(maxY, projectedY);
        }
      }
    }
    const width = Math.max((maxX - minX) * 1.1, (maxY - minY) * aspect * 1.1);
    const height = width / aspect;
    const near = 0.1, far = 50;
    const projection = new Float32Array([
      2 / width, 0, 0, 0,
      0, 2 / height, 0, 0,
      0, 0, -2 / (far - near), 0,
      0, 0, -(far + near) / (far - near), 1
    ]);
    return { matrix: multiplyMatrix(projection, view), eye };
  };

  const renderModel = ({ gl, program, model, buffers, uniforms, attributes, localTextures, fallbackTexture, weather }) => {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return false;
    const dpr = clampPixelRatio();
    const width = Math.max(1, Math.round(bounds.width * dpr));
    const height = Math.max(1, Math.round(bounds.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    const camera = viewProjection(width / height, model.bounds);
    gl.uniformMatrix4fv(uniforms.viewProjection, false, camera.matrix);
    gl.uniform3fv(uniforms.eye, camera.eye);
    gl.uniform1f(uniforms.wetness, weather.wetness);
    gl.uniform1f(uniforms.frostProgress, weather.frostProgress);
    gl.uniform1f(uniforms.time, weather.time);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    for (const entry of buffers) {
      const material = model.materials[entry.materialIndex] || { color: [0.15, 0.15, 0.15, 1], metallic: 0, roughness: 0.6, emissive: [0, 0, 0] };
      gl.bindBuffer(gl.ARRAY_BUFFER, entry.position);
      gl.enableVertexAttribArray(attributes.position);
      gl.vertexAttribPointer(attributes.position, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, entry.normal);
      gl.enableVertexAttribArray(attributes.normal);
      gl.vertexAttribPointer(attributes.normal, 3, gl.FLOAT, false, 0, 0);
      gl.uniform4fv(uniforms.color, material.color);
      gl.uniform1f(uniforms.metallic, material.metallic);
      gl.uniform1f(uniforms.roughness, material.roughness);
      gl.uniform3fv(uniforms.emissive, material.emissive);
      const materialName = (material.name || '').toLowerCase();
      const textureKey = materialName.includes('brushed black aluminium') ? 'brushed'
        : materialName.includes('black anodized side walls') ? 'graphite'
        : materialName.includes('powder coat') ? 'powder'
        : materialName.includes('epdm') ? 'rubber'
        : materialName.includes('connector polymer') || materialName.includes('socket recesses') ? 'polymer'
        : materialName.includes('machined nickel') || materialName.includes('stainless steel') ? 'steel'
        : materialName.includes('brass contacts') ? 'brass' : null;
      const localTexture = textureKey ? localTextures.get(textureKey) : null;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, localTexture?.texture || fallbackTexture);
      gl.uniform1i(uniforms.texture, 0);
      gl.uniform1f(uniforms.textureAmount, localTexture?.amount || 0);
      gl.uniform1f(uniforms.textureScale, localTexture?.scale || 1);
      if (material.doubleSided) gl.disable(gl.CULL_FACE);
      else gl.enable(gl.CULL_FACE);
      gl.drawArrays(gl.TRIANGLES, 0, entry.count);
    }
    gl.disableVertexAttribArray(attributes.position);
    gl.disableVertexAttribArray(attributes.normal);
    return true;
  };

  const start = async () => {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL is unavailable');
    const glb = await readGlb(modelUrl);
    const model = unpackModel(glb);
    const program = createProgram(gl);
    const uniform = name => gl.getUniformLocation(program, `u_${name}`);
    const uniforms = {
      viewProjection: uniform('viewProjection'), color: uniform('color'), metallic: uniform('metallic'),
      roughness: uniform('roughness'), emissive: uniform('emissive'), eye: uniform('eye')
    };
    uniforms.texture = uniform('texture');
    uniforms.textureScale = uniform('textureScale');
    uniforms.textureAmount = uniform('textureAmount');
    uniforms.wetness = uniform('wetness');
    uniforms.frostProgress = uniform('frostProgress');
    uniforms.time = uniform('time');
    const attributes = { position: gl.getAttribLocation(program, 'a_position'), normal: gl.getAttribLocation(program, 'a_normal') };
    const textureSources = [
      ['brushed', 'assets/models/reference-v2/textures/brushed-aluminium.svg', 0.78, 1.1],
      ['graphite', 'assets/models/reference-v2/textures/anodized-graphite.svg', 0.58, 1.25],
      ['powder', 'assets/models/reference-v2/textures/powder-coat.svg', 0.72, 1.5],
      ['rubber', 'assets/models/reference-v2/textures/epdm-rubber.svg', 0.65, 1.6],
      ['polymer', 'assets/models/reference-v2/textures/moulded-polymer.svg', 0.62, 1.4],
      ['steel', 'assets/models/reference-v2/textures/machined-steel.svg', 0.54, 1.2],
      ['brass', 'assets/models/reference-v2/textures/gold-plated-brass.svg', 0.46, 1.25]
    ];
    const localTextures = new Map();
    await Promise.all(textureSources.map(async ([key, url, amount, scale]) => {
      try {
        const image = new Image();
        image.decoding = 'async';
        image.src = `${url}?v=20261019-1`;
        await image.decode();
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.generateMipmap(gl.TEXTURE_2D);
        localTextures.set(key, { texture, amount, scale });
      } catch (error) {
        console.warn(`The local ${key} surface map could not be loaded.`, error);
      }
    }));
    const fallbackTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, fallbackTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const buffers = [];
    for (const [materialIndex, data] of model.buckets) {
      const position = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, position);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.positions), gl.STATIC_DRAW);
      const normal = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, normal);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normals), gl.STATIC_DRAW);
      buffers.push({ materialIndex, position, normal, count: data.positions.length / 3 });
    }
    const draw = () => renderModel({ gl, program, model, buffers, uniforms, attributes, localTextures, fallbackTexture, weather });
    drawWeatheredModel = draw;
    if (!draw()) throw new Error('The model canvas has no visible size');
    equipment.classList.add('testing-model-ready');
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(equipment);
    addEventListener('resize', draw, { passive: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) draw(); });
  };

  start().catch(error => console.warn('The local test unit model could not be displayed.', error));
})();
