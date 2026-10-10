/* Procedural 3D geometry based on the supplied front, side and top references.
 * Coordinates: +X nose, +Y up, +Z starboard. Dimensions are artistic, not CAD.
 * Both the point renderer and OBJ export use these same surface meshes.
 */
(() => {
  const meshes = [];
  const points = [];
  const TAU = Math.PI * 2;
  function surface(name, nu, nv, sample, material = () => .6, group = 'body', doubleSided = false) {
    const vertices = [], faces = [];
    for (let u = 0; u <= nu; u++) {
      for (let v = 0; v <= nv; v++) {
        const p = sample(u / nu, v / nv);
        vertices.push(p);
        const a = sample(Math.min(1, u / nu + .001), v / nv);
        const b = sample(u / nu, Math.min(1, v / nv + .001));
        const du = a.map((n, i) => n - p[i]), dv = b.map((n, i) => n - p[i]);
        const normal = [du[1]*dv[2]-du[2]*dv[1], du[2]*dv[0]-du[0]*dv[2], du[0]*dv[1]-du[1]*dv[0]];
        const length = Math.hypot(...normal) || 1;
        const direction=name.startsWith('wheel-')?1:-1;
        points.push({ x:p[0], y:p[1], z:p[2], nx:direction*normal[0]/length, ny:direction*normal[1]/length, nz:direction*normal[2]/length,
          light:material(p, u / nu, v / nv), group, doubleSided, edge:u===0 || v===0 || u===nu || v===nv });
        if (u < nu && v < nv) {
          const i = u * (nv + 1) + v;
          faces.push([i,i+nv+1,i+1],[i+1,i+nv+1,i+nv+2]);
        }
      }
    }
    if(!name.startsWith('wheel-')) faces.forEach(face=>face.reverse());
    meshes.push({name,vertices,faces,group});
  }
  function tube(name, stations, segments = 60, slices = 24, material, group, exponent=1) {
    const sample=(u,v) => {
      const t = u*(stations.length-1), i = Math.min(stations.length-2,Math.floor(t)), f = t-i;
      const s = stations[i].map((n,j)=>n+(stations[i+1][j]-n)*f);
      const c=Math.cos(v*TAU),sn=Math.sin(v*TAU);
      return [s[0],s[1]+s[2]*Math.sign(c)*Math.abs(c)**exponent,s[3]*Math.sign(sn)*Math.abs(sn)**exponent];
    };
    surface(name, segments, slices, sample, material, group);
    return sample;
  }
  function ellipsoid(name, center, radius, material) {
    surface(name,40,26,(u,v)=>{
      const a=u*TAU,b=(v-.5)*Math.PI;
      return [center[0]+radius[0]*Math.cos(a)*Math.cos(b),center[1]+radius[1]*Math.sin(b),center[2]+radius[2]*Math.sin(a)*Math.cos(b)];
    }, material);
  }
  function panel(name, corners, nu=32, nv=8, group='body', light=.65) {
    surface(name,nu,nv,(u,v)=>[0,1,2].map(i=>
      (1-u)*(1-v)*corners[0][i]+u*(1-v)*corners[1][i]+u*v*corners[2][i]+(1-u)*v*corners[3][i]),()=>light,group,true);
  }
  function rod(name,a,b,r=.025) {
    const d=b.map((n,i)=>n-a[i]), l=Math.hypot(...d);
    const e=d.map(n=>n/l), ref=Math.abs(e[1])>.9?[1,0,0]:[0,1,0];
    const n=[e[1]*ref[2]-e[2]*ref[1],e[2]*ref[0]-e[0]*ref[2],e[0]*ref[1]-e[1]*ref[0]];
    const nl=Math.hypot(...n); for(let i=0;i<3;i++) n[i]/=nl;
    const m=[e[1]*n[2]-e[2]*n[1],e[2]*n[0]-e[0]*n[2],e[0]*n[1]-e[1]*n[0]];
    surface(name,Math.max(8,Math.ceil(l*32)),8,(u,v)=>a.map((q,i)=>q+d[i]*u+r*(n[i]*Math.cos(v*TAU)+m[i]*Math.sin(v*TAU))),()=>.95);
  }

  const bodyStations=[
    [-1.65,0,.1,.12],[-1.25,0,.5,.52],[-.85,0,.7,.65],
    [-.25,0,.73,.68],[.4,0,.73,.68],[.85,-.015,.68,.64],
    [1.2,-.07,.57,.58],[1.55,-.19,.39,.48],[1.82,-.29,.23,.27],[1.9,-.3,.04,.06]
  ];
  const bodySample=tube('fuselage',bodyStations,150,72,(p,u,v)=>{
    const angle=v*TAU;
    const side=Math.abs(Math.sin(angle));
    // Dark cockpit glazing, passenger windows, brighter frames and door seams.
    if(p[0]>.65 && p[1]>.05 && side>.2) {
      if(Math.abs(p[0]-1.1)<.045 || Math.abs(p[1]-.38)<.035 || Math.abs(p[2])<.045) return 1;
      return .12;
    }
    if(p[0]>-.9 && p[0]<.55 && p[1]>.12 && p[1]<.52 && side>.85) {
      const seam=Math.abs(p[0]+.7)<.035 || Math.abs(p[0]+.15)<.035 || Math.abs(p[0]-.4)<.035;
      return seam ? .95 : .18;
    }
    return Math.abs(p[0]+.95)<.025 || Math.abs(p[0]-.55)<.025 ? .9 : .62;
  },'body',.62);
  function bodyU(x) {
    let i=bodyStations.findIndex((station,index)=>index<bodyStations.length-1 && x>=station[0] && x<=bodyStations[index+1][0]);
    if(i<0)i=bodyStations.length-2;
    return (i+(x-bodyStations[i][0])/(bodyStations[i+1][0]-bodyStations[i][0]))/(bodyStations.length-1);
  }
  // Surface-following window mullions and door outlines, on both sides.
  for(const side of [-1,1]) {
    for(const [name,x,a,b] of [
      ['windshield-center',1.55,.08,1.42],['cockpit-pillar',1.05,.35,1.48],
      ['cockpit-rear',.58,.4,1.6],['door-rear',-.95,.6,2.5],['door-front',.45,.6,2.5],
      ['window-pillar',-.28,.65,1.4]
    ]) {
      surface(`${name}-${side}`,45,2,(u,v)=>{
        const p=bodySample(bodyU(x+(v-.5)*.016),side*(a+(b-a)*u)/TAU);
        return [p[0],p[1]*1.006,p[2]*1.006];
      },()=>.97);
    }
    for(const [name,x1,x2,angle] of [
      ['window-sill',-.95,1.55,1.43],['window-roof',-.95,1.05,.62],['door-bottom',-.95,.45,2.48]
    ]) {
      surface(`${name}-${side}`,75,2,(u,v)=>{
        const p=bodySample(bodyU(x1+(x2-x1)*u),side*(angle+(v-.5)*.016)/TAU);
        return [p[0],p[1]*1.006,p[2]*1.006];
      },()=>.94);
    }
    // Circular engine intakes give the frontal view its characteristic twin openings.
    surface(`engine-intake-${side}`,40,5,(u,v)=>{
      const a=u*TAU,r=.21+v*.035;
      return [.51,.88+r*Math.cos(a),side*.47+r*Math.sin(a)];
    },()=>.9,'body',true);
  }
  tube('tail-boom',[[-1.1,.12,.31,.31],[-2.1,.27,.21,.22],[-3.4,.44,.13,.13],[-4.65,.57,.07,.075]],100,24);
  for(const side of [-1,1]) {
    surface(`engine-${side}`,48,28,(u,v)=>{
      const r=u<.15?.08+u:.235;
      return [-1.12+u*1.64,.88+r*Math.cos(v*TAU),side*.47+r*Math.sin(v*TAU)];
    },()=>.65);
    ellipsoid(`sponson-${side}`,[-.5,-.35,side*.83],[.85,.2,.2]);
    rod(`gear-front-${side}`,[1.0,-.43,side*.42],[.88,-1.1,side*.73],.045);
    rod(`gear-rear-${side}`,[-.95,-.4,side*.6],[-1.05,-1.1,side*.84],.045);
    for(const x of [.88,-1.05]) {
      surface(`wheel-${side}-${x}`,30,12,(u,v)=>{
        const a=u*TAU;
        return [x+.16*Math.cos(a),-1.14+.16*Math.sin(a),side*(x>0?.73:.84)+(v-.5)*.14];
      },(p,u,v)=>v<.12||v>.88?.7:.25);
    }
    panel(`stabilizer-${side}`,[[-3.6,.49,side*.1],[-3.9,.49,side*1.12],[-3.35,.49,side*1.12],[-3.1,.49,side*.1]],28,14);
  }
  panel('vertical-fin',[[-4.65,.5,0],[-4.8,1.72,0],[-4.42,1.72,0],[-4.06,.45,0]],35,24);
  rod('rotor-mast',[0,.76,0],[0,1.52,0],.085);
  ellipsoid('rotor-hub',[0,1.52,0],[.22,.11,.22]);
  for(let blade=0;blade<4;blade++) {
    const angle=blade*TAU/4+.35;
    const rotate=(r,z)=>[r*Math.cos(angle)-z*Math.sin(angle),1.53,r*Math.sin(angle)+z*Math.cos(angle)];
    panel(`main-blade-${blade}`,[rotate(.18,-.07),rotate(4.0,-.1),rotate(4.0,.13),rotate(.18,.1)],110,8,'mainRotor',.82);
  }
  for(let blade=0;blade<4;blade++) {
    const angle=blade*TAU/4;
    const rotate=(r,s)=>[-4.6+r*Math.cos(angle)-s*Math.sin(angle),.64+r*Math.sin(angle)+s*Math.cos(angle),.13];
    panel(`tail-blade-${blade}`,[rotate(.05,-.04),rotate(.65,-.06),rotate(.65,.06),rotate(.05,.04)],24,4,'tailRotor',.85);
  }
  window.HelicopterModel={points,meshes,toOBJ(){
    let offset=1;
    const lines=['# Reference-based helicopter. Units are relative.'];
    for(const mesh of meshes){
      lines.push(`o ${mesh.name}`);
      for(const v of mesh.vertices)lines.push(`v ${v.map(n=>n.toFixed(5)).join(' ')}`);
      for(const f of mesh.faces)lines.push(`f ${f.map(i=>i+offset).join(' ')}`);
      offset+=mesh.vertices.length;
    }
    return lines.join('\n');
  }};
})();
