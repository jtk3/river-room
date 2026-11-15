import { database } from '../../../lib/database';

import { defaultPlayers } from '../../../lib/players';
export const dynamic='force-dynamic';
export async function GET(){
 const row=await database().prepare('SELECT version,data FROM roster WHERE id=1').first<{version:number,data:string}>();
 return Response.json(row?{version:row.version,players:JSON.parse(row.data)}:{version:0,players:defaultPlayers},{headers:{'Cache-Control':'no-store'}});
}
