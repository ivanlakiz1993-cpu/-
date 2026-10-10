/* Five Figma storyboard poses, driven by scroll, not by elapsed time.
 * The first two share the same helicopter pose; only the achievement appears.
 * Ranges are scroll fractions. Endpoints are resting poses with reading holds.
 */
(() => {
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const t = clamp(value); return t * t * t * (t * (t * 6 - 15) + 10); };
  const ramp = (p, start, end) => smooth((p - start) / (end - start));
  const lerp = (a, b, t) => a + (b - a) * t;

  // Quaternion for a Y rotation followed by an X rotation.
  function orientation(yaw, pitch) {
    const sy = Math.sin(yaw / 2), cy = Math.cos(yaw / 2);
    const sx = Math.sin(pitch / 2), cx = Math.cos(pitch / 2);
    return [sx * cy, cx * sy, sx * sy, cx * cy];
  }
  function slerp(a, b, t) {
    let dot = a.reduce((sum, value, i) => sum + value * b[i], 0);
    if (dot < 0) { b = b.map(value => -value); dot = -dot; }
    if (dot > .9995) {
      const q = a.map((value, i) => lerp(value, b[i], t));
      const length = Math.hypot(...q);
      return q.map(value => value / length);
    }
    const angle = Math.acos(Math.min(1, dot)), divisor = Math.sin(angle);
    return a.map((value, i) => (value * Math.sin((1 - t) * angle) + b[i] * Math.sin(t * angle)) / divisor);
  }
  function matrix(q) {
    const [x, y, z, w] = q;
    return [
      1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w),
      2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w),
      2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)
    ];
  }
  const poses = [
    { node:'2276:25952', rotation:orientation(-.48,.24), box:[.075,.12,.86,.79], height:1000 },
    { node:'2277:26357', rotation:orientation(-Math.PI/2,.12), box:[-.08,.02,.91,.90], height:1000 },
    { node:'2277:26369', rotation:orientation(0,Math.PI/2), box:[-.015,.055,.89,.88], height:1053 },
    { node:'2278:26375', rotation:orientation(-Math.PI+.48,.18), box:[.13,.115,.77,.70], height:1053 }
  ];
  const transitions = [
    { start:.30, end:.47, from:0, to:1 },
    { start:.57, end:.74, from:1, to:2 },
    { start:.84, end:.97, from:2, to:3 }
  ];

  function sample(value) {
    const progress = clamp(value);
    let from = 0, to = 0, mix = 0;
    for (const transition of transitions) {
      if (progress >= transition.end) { from = to = transition.to; mix = 0; }
      else if (progress > transition.start) {
        from = transition.from; to = transition.to;
        mix = ramp(progress, transition.start, transition.end);
        break;
      } else break;
    }
    const rotation = slerp(poses[from].rotation, poses[to].rotation, mix);
    const achievement = [
      ramp(progress,.12,.20) * (1-ramp(progress,.30,.395)),
      ramp(progress,.375,.47) * (1-ramp(progress,.57,.665)),
      ramp(progress,.645,.74) * (1-ramp(progress,.84,.915)),
      ramp(progress,.895,.97)
    ];
    const scene = progress < .12 ? 1 : progress < .385 ? 2 : progress < .655 ? 3 : progress < .905 ? 4 : 5;
    return {progress,from,to,mix,rotation,matrix:matrix(rotation),achievement,scene,
      height:lerp(poses[from].height,poses[to].height,mix)};
  }
  window.HelicopterStoryboard = {sample,poses,matrix,lerp,smooth};
})();
