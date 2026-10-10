/* Utility helicopter rebuilt from the supplied front, side and overhead views.
 * +X = nose, +Y = up. Geometry is shared by the live renderer and OBJ export.
 */
(() => {
  const meshes = [], points = [], TAU = Math.PI * 2;
  const lerp = (a,b,t) => a+(b-a)*t;
  const normalize = a => { const l=Math.hypot(...a)||1; return a.map(v=>v/l); };
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const mainRotor = [0,1.92,0], tailRotor = [-6.15,.98,.23];
  function surface(name,nu,nv,sample,tone=.5,group='body') {
    const vertices=[],normals=[],tones=[],faces=[];
    for(let u=0;u<=nu;u++) for(let v=0;v<=nv;v++) {
      const a=u/nu,b=v/nv,p=sample(a,b),eps=.0001;
      const ua=sample(Math.max(0,a-eps),b),ub=sample(Math.min(1,a+eps),b);
      const va=sample(a,Math.max(0,b-eps)),vb=sample(a,Math.min(1,b+eps));
      const n=normalize(cross(vb.map((x,i)=>x-va[i]),ub.map((x,i)=>x-ua[i])));
      const light=typeof tone==='function'?tone(p,a,b):tone;
      vertices.push(p);normals.push(n);tones.push(light);
      points.push({x:p[0],y:p[1],z:p[2],nx:n[0],ny:n[1],nz:n[2],light,group});
      if(u<nu&&v<nv) { const i=u*(nv+1)+v; faces.push([i,i+1,i+nv+1],[i+1,i+nv+2,i+nv+1]); }
    }
    meshes.push({name,vertices,normals,tones,faces,group});
    return sample;
  }
  function ellipsoid(name,c,r,tone=.5,group='body') {
    surface(name,48,28,(u,v)=>{
      const a=u*TAU,b=(v-.5)*Math.PI;
      return [c[0]+r[0]*Math.cos(a)*Math.cos(b),c[1]+r[1]*Math.sin(b),c[2]+r[2]*Math.sin(a)*Math.cos(b)];
    },tone,group);
  }
  function curve(name,path,r=.016,tone=.9,segments=36,group='body') {
    surface(name,segments,8,(u,v)=>{
      const p=path(u),a=path(Math.max(0,u-.001)),b=path(Math.min(1,u+.001));
      const d=normalize(b.map((n,i)=>n-a[i]));
      const n=normalize(cross(d,Math.abs(d[1])>.9?[1,0,0]:[0,1,0])),m=cross(d,n);
      return p.map((x,i)=>x+r*(n[i]*Math.cos(v*TAU)+m[i]*Math.sin(v*TAU)));
    },tone,group);
  }
  const rod=(name,a,b,r=.02,tone=.8,group='body')=>curve(name,t=>a.map((n,i)=>lerp(n,b[i],t)),r,tone,Math.max(4,Math.ceil(Math.hypot(...a.map((n,i)=>n-b[i]))*12)),group);
  function panel(name,q,tone=.5,group='body',nu=14,nv=6) {
    surface(name,nu,nv,(u,v)=>[0,1,2].map(i=>(1-u)*(1-v)*q[0][i]+u*(1-v)*q[1][i]+u*v*q[2][i]+(1-u)*v*q[3][i]),tone,group);
  }
  // Rounded rectangular cabin, sloped windscreen, broad blunt chin.
  // Each station specifies x, roof, belly, half-width; spacing stays physical.
  const stations=[
    [-2.45,.49,-.10,.24],[-2.05,.84,-.69,.78],[-1.48,.98,-.98,1.02],
    [-.70,1.04,-1.04,1.08],[.30,1.04,-1.02,1.07],[1.04,.94,-.94,1.00],
    [1.55,.72,-.86,.91],[2.04,.40,-.74,.78],[2.45,.07,-.60,.59],
    [2.65,-.15,-.48,.33],[2.74,-.27,-.35,.055]
  ];
  function section(x) {
    let i=0;while(i<stations.length-2&&x>stations[i+1][0])i++;
    const a=stations[i],b=stations[i+1],t=(x-a[0])/(b[0]-a[0]);
    return a.map((n,j)=>lerp(n,b[j],t));
  }
  function skin(x,angle,lift=1) {
    const s=section(x),c=Math.cos(angle),z=Math.sin(angle),ex=.68;
    return [x,(s[1]+s[2])/2+(s[1]-s[2])/2*Math.sign(c)*Math.abs(c)**ex*lift,s[3]*Math.sign(z)*Math.abs(z)**ex*lift];
  }
  surface('cabin',140,88,(u,v)=>skin(lerp(-2.45,2.74,u),v*TAU),p=>p[1]<-.65?.32:.50);
  function skinLine(name,a,b,side,tone=.88,r=.012) {
    curve(name,t=>skin(lerp(a[0],b[0],t),side*lerp(a[1],b[1],t),1.014),r,tone,32);
  }
  function windowPanel(name,q,side) {
    surface(name,26,18,(u,v)=>{
      const x=(1-u)*(1-v)*q[0][0]+u*(1-v)*q[1][0]+u*v*q[2][0]+(1-u)*v*q[3][0];
      const a=(1-u)*(1-v)*q[0][1]+u*(1-v)*q[1][1]+u*v*q[2][1]+(1-u)*v*q[3][1];
      return skin(x,side*a,1.006);
    },.035);
    q.forEach((a,i)=>skinLine(`${name}-frame-${i}`,a,q[(i+1)%4],side,.9,.014));
  }
  for(const side of [-1,1]) {
    windowPanel(`windscreen-${side}`,[[1.07,.12],[1.16,.87],[2.31,1.36],[2.54,.16]],side);
    windowPanel(`pilot-window-${side}`,[[.37,.65],[.94,.68],[1.42,1.43],[.37,1.46]],side);
    windowPanel(`cabin-window-front-${side}`,[[-.51,.63],[.20,.63],[.20,1.42],[-.51,1.42]],side);
    windowPanel(`cabin-window-rear-${side}`,[[-1.37,.68],[-.68,.64],[-.68,1.42],[-1.37,1.42]],side);
    const door=[[-1.57,.45],[.30,.45],[.30,2.59],[-1.57,2.57]];
    door.forEach((p,i)=>skinLine(`sliding-door-${side}-${i}`,p,door[(i+1)%4],side,.68,.012));
    skinLine(`pilot-door-${side}`,[.34,1.49],[.34,2.55],side,.74);
    skinLine(`door-rail-${side}`,[-1.9,.43],[.30,.43],side,.86,.016);
    skinLine(`door-handle-${side}`,[-1.35,1.67],[-1.10,1.67],side,.98,.028);
    skinLine(`pilot-handle-${side}`,[.47,1.67],[.69,1.67],side,.98,.023);
    skinLine(`lower-panel-${side}`,[-1.75,2.25],[1.68,2.25],side,.60,.009);
    // Rounded undercarriage fairings are attached to the cabin, not floating pods.
    ellipsoid(`gear-fairing-${side}`,[-1.13,-.54,side*1.06],[.88,.28,.30],.48);
    rod(`main-gear-${side}`,[-1.12,-.63,side*1.08],[-1.30,-1.35,side*1.30],.065,.67);
    rod(`main-gear-brace-${side}`,[-.54,-.76,side*1.02],[-1.30,-1.29,side*1.30],.035,.75);
    // Twin turbine nacelles: tapered rear, dark intake, rolled bright rim.
    surface(`turbine-${side}`,54,40,(u,v)=>{
      const x=lerp(-1.89,.65,u),r=u<.12?lerp(.19,.36,u/.12):u>.88?lerp(.36,.30,(u-.88)/.12):.36;
      return [x,1.02+r*Math.cos(v*TAU),side*.65+r*Math.sin(v*TAU)];
    },.55);
    surface(`intake-dark-${side}`,1,48,(u,v)=>[.664,1.02+.285*u*Math.cos(v*TAU),side*.65+.285*u*Math.sin(v*TAU)],.015);
    curve(`intake-rim-${side}`,t=>[.67,1.02+.304*Math.cos(t*TAU),side*.65+.304*Math.sin(t*TAU)],.025,.98,56);
    for(let i=0;i<7;i++) rod(`engine-vent-${side}-${i}`,[-1.6+i*.09,1.24,side*.94],[-1.6+i*.09,1.04,side*1.016],.008,.16);
  }
  ellipsoid('transmission',[0,1.08,0],[.69,.46,.53],.51);
  rod('rotor-mast',[0,1.32,0],mainRotor,.085,.83);
  ellipsoid('swashplate',[0,1.57,0],[.32,.07,.32],.73);
  ellipsoid('main-hub',mainRotor,[.27,.11,.27],.88,'mainRotor');
  for(const side of [-1,1]) rod(`mast-link-${side}`,[side*.20,1.55,0],[side*.18,1.91,.08],.02,.98);
  // Tapered tail boom, swept fin, horizontal stabilizer.
  surface('tail-boom',96,32,(u,v)=>{
    const x=lerp(-2.12,-6.28,u),r=lerp(.40,.09,u),y=lerp(.08,.76,u);
    return [x,y+r*Math.cos(v*TAU),r*.92*Math.sin(v*TAU)];
  },.48);
  for(const side of [-1,1]) {
    const q=[[-6.23,.68,side*.065],[-6.33,2.38,side*.035],[-5.78,2.45,side*.035],[-5.40,.64,side*.07]];
    panel(`tail-fin-${side}`,q,.55);
    rod(`fin-edge-${side}`,q[1],q[2],.017,.85);
    panel(`horizontal-stabilizer-${side}`,[[-5.30,.64,side*.1],[-5.68,.63,side*1.44],[-5.07,.66,side*1.44],[-4.63,.66,side*.1]],.55);
    rod(`stabilizer-edge-${side}`,[-5.07,.66,side*1.44],[-4.63,.66,side*.1],.012,.82);
    curve(`tail-seam-${side}`,t=>[lerp(-2.4,-6.15,t),lerp(.25,.80,t),side*lerp(.34,.10,t)],.009,.74,50);
  }
  panel('fin-leading-edge',[[-5.78,2.45,-.035],[-5.78,2.45,.035],[-5.40,.64,.07],[-5.40,.64,-.07]],.68);
  // Tricycle landing gear, with capped tyres and metal hubs.
  function wheel(name,c,r,w) {
    surface(name,44,12,(u,v)=>{
      const a=u*TAU,rr=r*(.91+.09*Math.sin(v*Math.PI));
      return [c[0]+rr*Math.cos(a),c[1]+rr*Math.sin(a),c[2]+(v-.5)*w];
    },.13);
    for(const side of [-1,1]) {
      surface(`${name}-wall-${side}`,8,44,(u,v)=>[c[0]+r*.91*u*Math.cos(v*TAU),c[1]+r*.91*u*Math.sin(v*TAU),c[2]+side*w*.5],(p,u)=>u<.43?.65:.20);
      curve(`${name}-rim-${side}`,t=>[c[0]+r*.82*Math.cos(t*TAU),c[1]+r*.82*Math.sin(t*TAU),c[2]+side*w*.51],.009,.52,44);
    }
  }
  for(const side of [-1,1]) {
    wheel(`main-wheel-${side}`,[-1.30,-1.40,side*1.32],.255,.20);
    wheel(`nose-wheel-${side}`,[1.95,-1.47,side*.17],.19,.115);
  }
  rod('nose-gear',[1.78,-.65,0],[1.95,-1.45,0],.06,.71);
  rod('nose-gear-fork',[1.93,-1.33,-.22],[1.93,-1.33,.22],.035,.87);
  ellipsoid('chin-sensor',[2.46,-.56,0],[.22,.16,.18],.5);
  rod('roof-aerial',[-1.32,1.10,0],[-1.40,1.63,0],.012,.65);
  rod('belly-aerial',[.65,-1.01,0],[.80,-1.35,0],.011,.52);
  // Separate rotor groups rotate about their own hubs in the vertex shader.
  for(let blade=0;blade<4;blade++) {
    const a=blade*TAU/4+Math.PI/4;
    const p=(r,z,y=0)=>[mainRotor[0]+r*Math.cos(a)-z*Math.sin(a),mainRotor[1]+y,mainRotor[2]+r*Math.sin(a)+z*Math.cos(a)];
    panel(`main-blade-${blade}`,[p(.24,-.08),p(5.2,-.15,-.035),p(5.2,.15,-.035),p(.58,.15)],.64,'mainRotor',64,4);
    panel(`blade-tip-${blade}`,[p(4.99,-.15,-.035),p(5.2,-.15,-.035),p(5.2,.15,-.035),p(4.99,.15,-.035)],.92,'mainRotor',3,4);
    rod(`rotor-grip-${blade}`,p(.08,0),p(.60,0),.045,.82,'mainRotor');
    const t=blade*TAU/4;
    const q=(r,s)=>[tailRotor[0]+r*Math.cos(t)-s*Math.sin(t),tailRotor[1]+r*Math.sin(t)+s*Math.cos(t),tailRotor[2]];
    panel(`tail-blade-${blade}`,[q(.08,-.035),q(.87,-.07),q(.87,.085),q(.08,.035)],.70,'tailRotor',18,3);
  }
  ellipsoid('tail-hub',tailRotor,[.12,.12,.07],.86,'tailRotor');
  window.HelicopterModel={points,meshes,mainRotor,tailRotor,toOBJ(){
    let offset=1;
    const lines=['# Utility helicopter: shared with the live ASCII renderer.','# Separate main-blade / tail-blade objects; relative units.'];
    for(const mesh of meshes) {
      lines.push(`o ${mesh.name}`);
      for(const v of mesh.vertices) lines.push(`v ${v.map(n=>n.toFixed(5)).join(' ')}`);
      for(const n of mesh.normals) lines.push(`vn ${n.map(v=>v.toFixed(5)).join(' ')}`);
      for(const f of mesh.faces) lines.push(`f ${f.map(i=>`${i+offset}//${i+offset}`).join(' ')}`);
      offset+=mesh.vertices.length;
    }
    return lines.join('\n');
  }};
})();
