import { database } from '../../../lib/database';

import { error,sameOrigin } from '../../../lib/access';
export const dynamic='force-dynamic';
type Entry={id:string,name:string,kind:string,net:number};
type Event={id:string,tableId:string,handNumber:number,rosterVersion:number,players:Entry[]};
function valid(x:Event){
 if(!x || typeof x.id!=='string' || x.id.length>100 || !/^[a-zA-Z0-9:-]+$/.test(x.id) || typeof x.tableId!=='string' || !/^[a-zA-Z0-9-]{1,64}$/.test(x.tableId) || !Number.isSafeInteger(x.handNumber) || x.handNumber<1 || !Number.isSafeInteger(x.rosterVersion) || x.rosterVersion<0 || !Array.isArray(x.players) || x.players.length<1 || x.players.length>9)return false;
 const ids=new Set<string>();for(const p of x.players){if(!p || typeof p.id!=='string' || !/^(bot:[0-7]|human:[a-zA-Z0-9-]{1,64})$/.test(p.id)||ids.has(p.id)||typeof p.name!=='string'||p.name.trim().length<1||p.name.length>32||/[\u0000-\u001f\u007f]/.test(p.name)||!['bot','human'].includes(p.kind)||!Number.isSafeInteger(p.net)||Math.abs(p.net)>10000000)return false;if((p.kind==='bot')!==p.id.startsWith('bot:'))return false;ids.add(p.id);}return true;
}
export async function POST(req:Request){
 if(!sameOrigin(req))return error(403,'Invalid request origin');
 if(Number(req.headers.get('content-length')||0)>8192)return error(413,'Event too large');
 const x=await req.json().catch(()=>null) as Event|null;if(!x||!valid(x))return error(400,'Invalid result');
 const timestamp=Date.now(), payload=JSON.stringify(x);
 const hand=database().prepare('INSERT OR IGNORE INTO career_hands (id,table_id,hand_number,roster_version,recorded_at,payload) VALUES (?,?,?,?,?,?)').bind(x.id,x.tableId,x.handNumber,x.rosterVersion,timestamp,payload);
 const statements=x.players.map(p=>database().prepare('INSERT OR IGNORE INTO career_results (hand_id,player_id,name,kind,net) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM career_hands WHERE id=? AND payload=?)').bind(x.id,p.id,p.name.trim(),p.kind,p.net,x.id,payload));
 await database().batch([hand,...statements]);return Response.json({ok:true});
}
