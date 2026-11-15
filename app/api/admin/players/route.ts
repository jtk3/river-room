import { database } from '../../../../lib/database';

import { defaultPlayers, validPlayers } from '../../../../lib/players';
import { adminAuth,error,sameOrigin } from '../../../../lib/access';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const auth=adminAuth(req);if(auth!==200)return error(auth,auth===401?'Sign in required':'Owner access required');
 const row=await database().prepare('SELECT version,data FROM roster WHERE id=1').first<{version:number,data:string}>();
 return Response.json(row?{version:row.version,players:JSON.parse(row.data)}:{version:0,players:defaultPlayers},{headers:{'Cache-Control':'no-store'}});
}
export async function PUT(req:Request){
 const auth=adminAuth(req);if(auth!==200)return error(auth,'Owner access required');if(!sameOrigin(req))return error(403,'Invalid request origin');
 const body=await req.json().catch(()=>null) as {version:number,players:unknown}|null;
 if(!body || !Number.isSafeInteger(body.version) || body.version<0 || !validPlayers(body.players))return error(400,'Invalid roster');
 const players=body.players.map(p=>({name:p.name.trim(),personality:p.personality}));const data=JSON.stringify(players);const now=Date.now(), next=body.version+1;
 // Conditional update prevents stale editors overwriting more recent changes.
 const sql=body.version===0?'INSERT OR IGNORE INTO roster (id,version,data,updated_at) VALUES (1,?,?,?)':'UPDATE roster SET version=?,data=?,updated_at=? WHERE id=1 AND version=?';
 const args=body.version===0?[next,data,now]:[next,data,now,body.version];
 const [result]=await database().batch([database().prepare(sql).bind(...args),database().prepare('INSERT OR IGNORE INTO roster_history (version,data,updated_at) SELECT version,data,updated_at FROM roster WHERE id=1 AND version=?').bind(next)]);if(result.meta.changes!==1)return error(409,'Settings changed elsewhere; reload before saving');
 return Response.json({version:next,players});
}
