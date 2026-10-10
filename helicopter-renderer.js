/* Lit, depth-tested mesh -> screen-space ASCII. No per-vertex dot drawing. */
(() => {
  const meshVertex=`
    attribute vec3 a_position, a_normal;
    attribute float a_tone, a_group;
    uniform mat3 u_rotation;
    uniform vec2 u_size, u_center;
    uniform float u_scale, u_angle;
    uniform vec3 u_main, u_tail;
    varying vec3 v_normal;
    varying float v_tone;
    void main(){
      vec3 p=a_position,n=a_normal;
      if(a_group>.5 && a_group<1.5){
        float c=cos(u_angle),s=sin(u_angle);p-=u_main;
        p.xz=mat2(c,s,-s,c)*p.xz;n.xz=mat2(c,s,-s,c)*n.xz;p+=u_main;
      }else if(a_group>1.5){
        float c=cos(u_angle*3.2),s=sin(u_angle*3.2);p-=u_tail;
        p.xy=mat2(c,s,-s,c)*p.xy;n.xy=mat2(c,s,-s,c)*n.xy;p+=u_tail;
      }
      p=u_rotation*p;v_normal=u_rotation*n;v_tone=a_tone;
      float d=22.-p.z;
      vec2 offset=vec2(u_center.x/u_size.x*2.-1.,1.-u_center.y/u_size.y*2.);
      vec2 clip=offset*d+p.xy*u_scale*44./u_size;
      gl_Position=vec4(clip,51./49.*d-100./49.,d);
    }`;
  const meshFragment=`
    precision mediump float;
    varying vec3 v_normal;varying float v_tone;
    void main(){
      vec3 n=normalize(v_normal);if(n.z<0.)n=-n;
      vec3 key=normalize(vec3(-.45,.8,1.1));
      float diffuse=max(0.,dot(n,key));
      float rim=pow(1.-abs(n.z),2.2);
      float spec=pow(max(0.,dot(n,normalize(key+vec3(0.,0.,1.)))),26.);
      float light=v_tone*(.20+.72*diffuse)+(.16*rim+.12*spec)*min(1.,v_tone*2.);
      gl_FragColor=vec4(vec3(clamp(light,0.,1.)),1.);
    }`;
  const screenVertex=`attribute vec2 a_position;void main(){gl_Position=vec4(a_position,0.,1.);}`;
  const asciiFragment=`
    precision mediump float;
    uniform sampler2D u_scene,u_glyphs;
    uniform vec2 u_resolution,u_cell;
    void main(){
      vec2 cell=floor(gl_FragCoord.xy/u_cell);
      vec2 uv=(cell+.5)*u_cell/u_resolution;
      float lum=texture2D(u_scene,uv).r;
      if(lum<.022){gl_FragColor=vec4(0.,0.,0.,1.);return;}
      float index=floor(clamp(lum*1.65,0.,.999)*10.);
      vec2 local=fract(gl_FragCoord.xy/u_cell);
      vec2 atlas=vec2((index+local.x)/10.,local.y);
      float glyph=texture2D(u_glyphs,atlas).r;
      float halo=texture2D(u_glyphs,atlas+vec2(.0015,0.)).r+texture2D(u_glyphs,atlas-vec2(.0015,0.)).r;
      float ink=(glyph+.12*halo)*(.20+lum*.86);
      gl_FragColor=vec4(vec3(.91,.89,.84)*ink,1.);
    }`;

  function create(canvas,model) {
    const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:true,powerPreference:'high-performance'});
    if(!gl)return null;
    const resources=[];
    function shader(type,source) {
      const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));
      resources.push(['Shader',s]);return s;
    }
    function program(v,f) {
      const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,v));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);
      if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
      resources.push(['Program',p]);return p;
    }
    try {
      const meshProgram=program(meshVertex,meshFragment),asciiProgram=program(screenVertex,asciiFragment);
      const location=(p,n)=>gl.getUniformLocation(p,n);
      const meshUniforms=Object.fromEntries(['rotation','size','center','scale','angle','main','tail'].map(n=>[n,location(meshProgram,'u_'+n)]));
      const asciiUniforms=Object.fromEntries(['scene','glyphs','resolution','cell'].map(n=>[n,location(asciiProgram,'u_'+n)]));
      const attributes=['position','normal','tone','group'].map(n=>gl.getAttribLocation(meshProgram,'a_'+n));
      const screenAttribute=gl.getAttribLocation(asciiProgram,'a_position');
      const data=[];
      for(const mesh of model.meshes) {
        const group=mesh.group==='mainRotor'?1:mesh.group==='tailRotor'?2:0;
        for(const face of mesh.faces)for(const i of face)data.push(...mesh.vertices[i],...mesh.normals[i],mesh.tones[i],group);
      }
      function buffer(data){const b=gl.createBuffer();resources.push(['Buffer',b]);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);return b;}
      const meshBuffer=buffer(data),count=data.length/8;
      const screenBuffer=buffer([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]);
      function texture(){const t=gl.createTexture();resources.push(['Texture',t]);gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
      const sceneTexture=texture(),glyphTexture=texture();
      const atlas=document.createElement('canvas');atlas.width=320;atlas.height=40;
      const ctx=atlas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,320,40);
      ctx.fillStyle='#fff';ctx.font='28px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
      [...' .:-+*<>01'].forEach((char,i)=>ctx.fillText(char,i*32+16,20));
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      const framebuffer=gl.createFramebuffer(),depth=gl.createRenderbuffer();
      resources.push(['Framebuffer',framebuffer],['Renderbuffer',depth]);
      gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,sceneTexture,0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
      let width=1,height=1,dpr=1;
      function resize(w,h,ratio=1){
        width=w;height=h;dpr=Math.min(ratio,1.5);
        const pw=Math.max(1,Math.round(w*dpr)),ph=Math.max(1,Math.round(h*dpr));
        if(canvas.width===pw&&canvas.height===ph)return;
        canvas.width=pw;canvas.height=ph;
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,sceneTexture);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,pw,ph,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,pw,ph);
        gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Helicopter framebuffer is incomplete');
      }
      function render({matrix,scale,centerX,centerY,angle}){
        if(gl.isContextLost())return;
        gl.viewport(0,0,canvas.width,canvas.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
        gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(meshProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER,meshBuffer);
        [3,3,1,1].forEach((size,i)=>{gl.enableVertexAttribArray(attributes[i]);gl.vertexAttribPointer(attributes[i],size,gl.FLOAT,false,32,[0,12,24,28][i]);});
        gl.uniformMatrix3fv(meshUniforms.rotation,false,new Float32Array([matrix[0],matrix[3],matrix[6],matrix[1],matrix[4],matrix[7],matrix[2],matrix[5],matrix[8]]));
        gl.uniform2f(meshUniforms.size,width,height);gl.uniform2f(meshUniforms.center,centerX,centerY);
        gl.uniform1f(meshUniforms.scale,scale);gl.uniform1f(meshUniforms.angle,angle);
        gl.uniform3fv(meshUniforms.main,model.mainRotor);gl.uniform3fv(meshUniforms.tail,model.tailRotor);
        gl.drawArrays(gl.TRIANGLES,0,count);attributes.forEach(a=>gl.disableVertexAttribArray(a));
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.disable(gl.DEPTH_TEST);gl.useProgram(asciiProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER,screenBuffer);gl.enableVertexAttribArray(screenAttribute);gl.vertexAttribPointer(screenAttribute,2,gl.FLOAT,false,0,0);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,sceneTexture);gl.uniform1i(asciiUniforms.scene,0);
        gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,glyphTexture);gl.uniform1i(asciiUniforms.glyphs,1);
        gl.uniform2f(asciiUniforms.resolution,canvas.width,canvas.height);
        const cell=Math.max(4.2,width/320)*dpr;
        gl.uniform2f(asciiUniforms.cell,cell,cell*1.18);
        gl.drawArrays(gl.TRIANGLES,0,6);gl.disableVertexAttribArray(screenAttribute);
      }
      return {resize,render,destroy(){resources.forEach(([type,r])=>gl['delete'+type](r));}};
    } catch(error) {
      resources.forEach(([type,r])=>gl['delete'+type](r));
      console.warn('Helicopter rendering unavailable:',error.message);
      return null;
    }
  }
  window.HelicopterRenderer={create};
})();
