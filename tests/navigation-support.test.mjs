import test from 'node:test';
import assert from 'node:assert/strict';
import {Collision,Navigation} from '../dist/src/simulation/collision.js';
import {MAPS} from '../dist/src/content/maps.js';
test('navigation cannot bridge two raised props through unsupported equal-height space',()=>{
 const map={...MAPS.range,size:[12,12],boxes:[-2,0].map((x,i)=>({id:'prop'+i,p:[x,.5,0],s:[.5,1,.5],solid:true,kind:'planter',color:[.3,.3,.3]})),surfaces:[],doors:[]};
 const nav=new Navigation(new Collision(map));
 const a=nav.nodes.get('-2,0,1'),b=nav.nodes.get('0,0,1');
 assert(a&&b);
 assert(!a.neighbors.includes(b.key));assert(!b.neighbors.includes(a.key));
});
