import { database } from '../../../lib/database';

export const dynamic='force-dynamic';
export async function GET(){
 const results=await database().prepare(`SELECT player_id, kind, (SELECT r2.name FROM career_results r2 JOIN career_hands h2 ON h2.id=r2.hand_id WHERE r2.player_id=r.player_id ORDER BY h2.recorded_at DESC LIMIT 1) AS name, COUNT(*) AS hands, SUM(net) AS net FROM career_results r GROUP BY player_id,kind ORDER BY net DESC LIMIT 250`).all();
 return Response.json({players:results.results},{headers:{'Cache-Control':'no-store'}});
}
