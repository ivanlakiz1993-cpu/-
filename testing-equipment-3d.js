/* Rebuild the test-unit casing as a small lit WebGL model. The exact front
   panel is cropped from the local Figma export; the enclosure is real geometry. */
(() => {
  const stage = document.querySelector('.testing-equipment-showcase');
  const canvas = stage?.querySelector('canvas');
  const source = stage?.querySelector('img');
  if (!stage || !canvas || !source) return;

  const vertexShader = `
    attribute vec3 a_position, a_normal, a_color;
    attribute vec2 a_uv;
    attribute float a_front;
    uniform vec2 u_resolution;
    uniform float u_yaw, u_pitch, u_reflection;
    varying vec3 v_normal, v_color;
    varying vec2 v_uv;
    varying float v_front, v_reflection, v_height;
    void main(){
      vec3 p=a_position, n=a_normal;
      if(u_reflection>.5){p.y=-p.y-1.82;n.y=-n.y;}
      float cy=cos(u_yaw),sy=sin(u_yaw);
      p.xz=mat2(cy,sy,-sy,cy)*p.xz;
      n.xz=mat2(cy,sy,-sy,cy)*n.xz;
      float cx=cos(u_pitch),sx=sin(u_pitch);
      p.yz=mat2(cx,sx,-sx,cx)*p.yz;
      n.yz=mat2(cx,sx,-sx,cx)*n.yz;
      float depth=10.5-p.z, f=4.45, aspect=u_resolution.x/u_resolution.y;
      gl_Position=vec4(p.x*f/aspect,p.y*f,(41.0/39.0)*depth-80.0/39.0,depth);
      v_normal=n;v_color=a_color;v_uv=a_uv;v_front=a_front;
      v_reflection=u_reflection;v_height=p.y;
    }`;
  const fragmentShader = `
    precision mediump float;
    uniform sampler2D u_panel;
    varying vec3 v_normal,v_color;
    varying vec2 v_uv;
    varying float v_front,v_reflection,v_height;
    void main(){
      vec3 n=normalize(v_normal);
      vec3 key=normalize(vec3(-.45,.8,1.2));
      float diffuse=max(0.0,dot(n,key));
      float edge=pow(1.0-abs(n.z),2.0);
      vec3 metal=v_color*(.24+.78*diffuse)+vec3(.16)*edge;
      vec3 panel=texture2D(u_panel,v_uv).rgb;
      vec3 color=mix(metal,panel,v_front);
      float fade=mix(1.0,smoothstep(-2.9,-.9,v_height),v_reflection);
      float alpha=mix(1.0,.23*fade,v_reflection);
      gl_FragColor=vec4(color,alpha);
    }`;

  function compile(gl, type, sourceText) {
    const shader=gl.createShader(type);
    gl.shaderSource(shader,sourceText);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  function makeGeometry(){
    const data=[],w=3.88,h=.91,d=1.55;
    const addFace=(corners,normal,color,front=false)=>{
      const uvs=[[0,0],[1,0],[1,1],[0,1]],order=[0,1,2,0,2,3];
      order.forEach(i=>data.push(...corners[i],...normal,...uvs[i],...color,front?1:0));
    };
    const c=(r,g,b)=>[r,g,b];
    // Top and side faces make the enclosure visibly three-dimensional.
    addFace([[-w,-h,-d],[w,-h,-d],[w,h,-d],[-w,h,-d]],[0,0,-1],c(.07,.075,.085));
    addFace([[-w,h,-d],[w,h,-d],[w,h,d],[-w,h,d]],[0,1,0],c(.19,.20,.22));
    addFace([[-w,-h,d],[w,-h,d],[w,-h,-d],[-w,-h,-d]],[0,-1,0],c(.055,.06,.07));
    addFace([[-w,-h,-d],[-w,h,-d],[-w,h,d],[-w,-h,d]],[-1,0,0],c(.12,.13,.145));
    addFace([[w,-h,d],[w,h,d],[w,h,-d],[w,-h,-d]],[1,0,0],c(.10,.11,.125));
    // The face is its own plane so it can keep the exact photographed labels,
    // connectors, controls, and the metallic border from the supplied design.
    addFace([[-w,-h,d+.012],[w,-h,d+.012],[w,h,d+.012],[-w,h,d+.012]],[0,0,1],c(1,1,1),true);
    return new Float32Array(data);
  }

  function start(){
    let gl;
    try {
      gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'high-performance'});
      if(!gl)return;
      const program=gl.createProgram();
      gl.attachShader(program,compile(gl,gl.VERTEX_SHADER,vertexShader));
      gl.attachShader(program,compile(gl,gl.FRAGMENT_SHADER,fragmentShader));
      gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      const vertices=makeGeometry(),buffer=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
      gl.useProgram(program);
      const stride=12*4;
      [["a_position",3,0],["a_normal",3,3*4],["a_uv",2,6*4],["a_color",3,8*4],["a_front",1,11*4]].forEach(([name,size,offset])=>{
        const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,stride,offset);
      });
      const panelCanvas=document.createElement('canvas');panelCanvas.width=1200;panelCanvas.height=282;
      const panelContext=panelCanvas.getContext('2d');
      const cropX=source.naturalWidth*.055,cropY=source.naturalHeight*.178;
      panelContext.drawImage(source,cropX,cropY,source.naturalWidth*.89,source.naturalHeight*.43,0,0,panelCanvas.width,panelCanvas.height);
      const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,panelCanvas);
      const uniforms={};['resolution','yaw','pitch','reflection','panel'].forEach(name=>uniforms[name]=gl.getUniformLocation(program,'u_'+name));
      gl.uniform1i(uniforms.panel,0);gl.uniform1f(uniforms.yaw,.16);gl.uniform1f(uniforms.pitch,.28);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      const render=()=>{
        const rect=stage.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5);
        const width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));
        if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
        gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        gl.uniform2f(uniforms.resolution,width,height);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.uniform1f(uniforms.reflection,1);gl.drawArrays(gl.TRIANGLES,0,vertices.length/12);
        gl.clear(gl.DEPTH_BUFFER_BIT);gl.uniform1f(uniforms.reflection,0);gl.drawArrays(gl.TRIANGLES,0,vertices.length/12);
      };
      render();
      stage.classList.add('is-3d-ready');
      if('ResizeObserver'in window)new ResizeObserver(render).observe(stage);
      else window.addEventListener('resize',render,{passive:true});
    } catch(error) {
      if(gl?.getError)console.warn('3D корпус не удалось отрисовать:',error.message);
    }
  }

  if(source.complete&&source.naturalWidth)start();
  else source.addEventListener('load',start,{once:true});
})();
