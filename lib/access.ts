import { env } from 'cloudflare:workers';
export function adminAuth(req: Request): number {
  const identity=req.headers.get('oai-authenticated-user-email');
  if(!identity) return 401;
  const owner=(env as unknown as {RIVER_OWNER_EMAIL?:string}).RIVER_OWNER_EMAIL;
  if(!owner || identity.toLowerCase()!==owner.toLowerCase()) return 403;
  return 200;
}
export function error(status:number,message:string){return Response.json({error:message},{status,headers:{'Cache-Control':'no-store'}});}
export function sameOrigin(req:Request){const origin=req.headers.get('Origin');return !!origin && origin===new URL(req.url).origin;}
