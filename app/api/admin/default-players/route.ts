import { defaultPlayers } from '../../../../lib/players';
import { adminAuth,error } from '../../../../lib/access';
export const dynamic='force-dynamic';
export async function GET(req:Request){const code=adminAuth(req);return code===200?Response.json({players:defaultPlayers}):error(code,'Owner access required');}
