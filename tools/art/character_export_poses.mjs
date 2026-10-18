import fs from 'node:fs/promises';
import {characterJointPose} from '../../dist/src/rendering/apparel.js';
import {createWeapon} from '../../dist/src/domain/items.js';
const weapon=createWeapon('weapon_ak74m',false);
const poses={idle:characterJointPose(0,0,false),walk:characterJointPose(.83,.7,false),run:characterJointPose(.43,1.2,false),crouch:characterJointPose(0,0,true),hold:characterJointPose(0,0,false,{gun:weapon}),reload:characterJointPose(0,0,false,{gun:weapon,weaponPose:{reload:.45,mode:'swap'}})};
await fs.mkdir('art/overhaul/character_sources/qa',{recursive:true});
await fs.writeFile('art/overhaul/character_sources/qa/poses.json',JSON.stringify(poses,null,2)+'\n');
