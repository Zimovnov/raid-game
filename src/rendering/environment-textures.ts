import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { SurfaceTexture } from '../domain/types.js';
import { rng } from '../domain/util.js';

export const foliageSurface = (name?: SurfaceTexture) => name === 'pine' || name === 'leaves' || name === 'grass';
/** Original seamless surfaces and cutout vegetation, generated once per renderer. */
export function environmentTexture(name: SurfaceTexture, scene: Scene): DynamicTexture {
    const size=256, texture=new DynamicTexture('environment-'+name,{width:size,height:size},scene,true);
    const ctx=texture.getContext() as CanvasRenderingContext2D, random=rng(602+name.length);
    if(foliageSurface(name)) {
        ctx.clearRect(0,0,size,size);
        if(name==='grass') {
            for(let i=0;i<95;i++) {
                const x=random()*256,h=35+random()*200,bend=(random()-.5)*65;
                ctx.fillStyle=`rgb(${95+random()*85},${110+random()*75},${45+random()*60})`;
                ctx.beginPath();ctx.moveTo(x-2,256);ctx.quadraticCurveTo(x+bend*.2,256-h*.6,x+bend,256-h);ctx.quadraticCurveTo(x+5,256-h*.3,x+3,256);ctx.fill();
            }
        } else if(name==='pine') {
            ctx.strokeStyle='#655b3a';ctx.lineWidth=3;
            ctx.beginPath();ctx.moveTo(128,249);ctx.lineTo(128,12);ctx.stroke();
            for(let n=0;n<22;n++) for(const side of [-1,1]) {
                const y=36+n*8.6,length=(22+n*3.6)*( .8+random()*.25);
                ctx.strokeStyle='#686b42';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(128,y);ctx.lineTo(128+side*length,y+24);ctx.stroke();
                for(let j=0;j<35;j++) {
                    const t=random(),x=128+side*length*t,yy=y+24*t;
                    ctx.strokeStyle=`rgb(${80+random()*70},${100+random()*65},${55+random()*45})`;
                    ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+side*(4+random()*11),yy-8-random()*13);ctx.stroke();
                }
            }
        } else {
            for(let n=0;n<24;n++) {
                const angle=random()*Math.PI*2,length=30+random()*85,x=128+Math.cos(angle)*length,y=128+Math.sin(angle)*length;
                ctx.strokeStyle='#706a4b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(128,224);ctx.lineTo(x,y);ctx.stroke();
                for(let j=0;j<22;j++) {
                    const xx=x+(random()-.5)*65,yy=y+(random()-.5)*55;
                    ctx.fillStyle=`rgb(${105+random()*90},${125+random()*75},${55+random()*70})`;
                    ctx.beginPath();ctx.ellipse(xx,yy,3+random()*6,2+random()*3,random()*6,0,Math.PI*2);ctx.fill();
                }
            }
        }
        texture.hasAlpha=true;
    } else {
        const image=ctx.createImageData(size,size);
        const hash=(x:number,y:number)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
        for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
            let v=170+(hash(x,y)-.5)*38;
            if(name==='wood'||name==='bark') {
                const grain=Math.sin(x*.24+Math.sin(y*Math.PI/128)*2.4)+Math.sin(x*1.6+y*.025);
                v=170+grain*18+(hash(x,y)-.5)*38;
                if(name==='wood' && (x%64<3 || y%128<2))v=64;
                if(name==='bark')v-=Math.max(0,Math.sin(x*.5+Math.sin(y*.09)))*65;
                if(name==='wood' && Math.sin(x*.06)*Math.sin(y*.10)>.5)v+=28;
            } else if(name==='brick') {
                const row=Math.floor(y/32),xx=(x+(row%2)*32)%64;
                v=xx<3||y%32<3?115:167+(hash(Math.floor((x+(row%2)*32)/64),row)-.5)*45+(hash(x,y)-.5)*24;
            } else if(name==='soil') v=160+Math.sin(x*Math.PI/32)*Math.sin(y*Math.PI/64)*19+(hash(x,y)-.5)*65;
            else if(name==='asphalt')v=150+(hash(x,y)-.5)*70;
            else if(name==='metal')v=175+Math.sin(x*Math.PI/8)*18+(hash(x,y)-.5)*28;
            const i=(y*size+x)*4; image.data[i]=v;image.data[i+1]=v;image.data[i+2]=v;image.data[i+3]=255;
        }
        ctx.putImageData(image,0,0);
    }
    texture.wrapU=texture.wrapV=1;texture.anisotropicFilteringLevel=8;texture.update();return texture;
}
