import type { Part, Vec3 } from '../domain/types.js';
import { geometry } from './geometry.js';
import { model, transform } from './math.js';
import { add, dot, norm, sub } from '../domain/util.js';
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
/** Pointer picking intersects visible triangles, not screen-space centres or hidden parts. */
export function pickGeometry(parts:Part[],eye:Vec3,target:Vec3,fov:number,aspect:number,nx:number,ny:number):string {
    if(![...eye,...target,fov,aspect,nx,ny].every(Number.isFinite)||aspect<=0)return '';
    const forward=norm(sub(target,eye)),right=norm(cross(forward,[0,1,0])),up=cross(right,forward),scale=Math.tan(fov*Math.PI/360);
    const dir=norm(add(forward,[right[0]*nx*scale*aspect+up[0]*ny*scale,right[1]*nx*scale*aspect+up[1]*ny*scale,right[2]*nx*scale*aspect+up[2]*ny*scale]));
    let best=Infinity,slot='';
    for(const p of parts){if(p.assetOnly)continue;const vertices=geometry(p.shape).vertices,m=model(p.p,p.s,p.r);
        for(let i=0;i<vertices.length;i+=18){
            const a=transform(m,[vertices[i],vertices[i+1],vertices[i+2]]),b=transform(m,[vertices[i+6],vertices[i+7],vertices[i+8]]),c=transform(m,[vertices[i+12],vertices[i+13],vertices[i+14]]);
            const e1=sub(b,a),e2=sub(c,a),h=cross(dir,e2),det=dot(e1,h);if(Math.abs(det)<1e-9)continue;
            const s=sub(eye,a),u=dot(s,h)/det;if(u<0||u>1)continue;const q=cross(s,e1),v=dot(dir,q)/det;if(v<0||u+v>1)continue;
            const distance=dot(e2,q)/det;if(distance>.001&&distance<best){best=distance;slot=p.slot||'';}
        }
    }
    return slot;
}
