import Database from 'better-sqlite3';
import { validateProfile } from '../dist/src/domain/profile.js';
const file=process.argv[2];
if(!file)throw Error('Pass a verified backup copy of SQLite');
const db=new Database(file,{readonly:true,fileMustExist:true});
try{
 if(db.pragma('integrity_check',{simple:true})!=='ok')throw Error('SQLite integrity check failed');
 let checked=0;
 for(const row of db.prepare('SELECT profile_json FROM accounts').iterate()){
  validateProfile(JSON.parse(row.profile_json));checked++;
 }
 console.log(JSON.stringify({databaseCompatibility:'PASSED',profiles:checked,profileSchema:3}));
}finally{db.close();}
