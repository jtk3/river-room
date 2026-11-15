import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';

const sql = readdirSync('drizzle').find(n=>n.endsWith('.sql'));
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(readFileSync(`drizzle/${sql}`,'utf8'));
class Statement {
 constructor(query){this.query=query;this.params=[];}
 bind(...params){this.params=params;return this;}
 async first(){return sqlite.prepare(this.query).get(...this.params) ?? null;}
 async all(){return {results:sqlite.prepare(this.query).all(...this.params)};}
 async run(){const result=sqlite.prepare(this.query).run(...this.params);return {meta:{changes:Number(result.changes)}};}
}
globalThis.__testEnv={RIVER_OWNER_EMAIL:'owner@example.test',DB:{prepare:sql=>new Statement(sql),batch:async statements=>{sqlite.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sqlite.exec('COMMIT');return out;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}};
async function load(path){
 const b=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'mock-workers',setup(builder){builder.onResolve({filter:/^cloudflare:workers$/},()=>({path:'mock',namespace:'mock'}));builder.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const env = globalThis.__testEnv;',loader:'js'}));}}]});
 return import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);
}
const admin=await load('app/api/admin/players/route.ts');
const results=await load('app/api/results/route.ts');
const ranks=await load('app/api/rankings/route.ts');
const url='https://river.example.test';
const req=(path,method='GET',body,headers={})=>new Request(url+path,{method,headers:{origin:url,...headers},...(body?{body:JSON.stringify(body)}:{})});
const owner={'oai-authenticated-user-email':'owner@example.test'};
const traits={selectiveness:50,aggression:50,bluffing:50,betSize:50};
const players=Array.from({length:8},(_,i)=>({name:`Test ${i}`,personality:traits}));

test('admin access is owner-only, validates settings, rejects stale edits, and stores history',async()=>{
 assert.equal((await admin.GET(req('/api/admin/players'))).status,401);
 assert.equal((await admin.GET(req('/api/admin/players','GET',null,{'oai-authenticated-user-email':'other@example.test'}))).status,403);
 assert.equal((await admin.GET(req('/api/admin/players','GET',null,owner))).status,200);
 assert.equal((await admin.PUT(req('/api/admin/players','PUT',{version:0,players}, {...owner,origin:'https://attacker.test'}))).status,403);
 assert.equal((await admin.PUT(req('/api/admin/players','PUT',{version:0,players:[{name:'Bad'}]},owner))).status,400);
 const saved=await admin.PUT(req('/api/admin/players','PUT',{version:0,players},owner));assert.equal(saved.status,200);assert.equal((await saved.json()).version,1);
 assert.equal((await admin.PUT(req('/api/admin/players','PUT',{version:0,players},owner))).status,409);
 const row=sqlite.prepare('SELECT * FROM roster_history WHERE version=1').get();assert.ok(row);
});

test('completed hand posting is idempotent and cannot be extended by changing a repeated payload',async()=>{
 const event={id:'table-1:1',tableId:'table-1',handNumber:1,rosterVersion:1,players:[{id:'human:abc',name:'Lynette',kind:'human',net:100},{id:'bot:0',name:'Bot',kind:'bot',net:-100}]};
 assert.equal((await results.POST(req('/api/results','POST',event))).status,200);
 assert.equal((await results.POST(req('/api/results','POST',event))).status,200);
 const altered={...event,players:[...event.players,{id:'bot:1',name:'Added',kind:'bot',net:5}]};
 assert.equal((await results.POST(req('/api/results','POST',altered))).status,200);
 const body=await (await ranks.GET()).json();assert.equal(body.players.length,2);assert.equal(body.players[0].net,100);assert.equal(body.players[0].hands,1);
 assert.equal((await results.POST(req('/api/results','POST',{...event,id:'x',players:[{id:'bad',name:'X',kind:'human',net:1}]}))).status,400);
});
