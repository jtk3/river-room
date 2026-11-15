export type Personality = {selectiveness:number,aggression:number,bluffing:number,betSize:number};
export type Player = {name:string,personality:Personality};
const names = ['HAL','Data','T2','Vision','R2-D2','Ultron','TARS','K-2SO'];
// Values approximate the existing eight strategy profiles on 0-100 scales.
const values = [[70,60,10,39],[38,80,43,50],[15,13,3,21],[90,30,1,39],[53,48,17,36],[25,92,77,71],[55,55,34,32],[35,28,14,29]];
export const defaultPlayers: Player[] = names.map((name,i)=>({name,personality:{selectiveness:values[i][0],aggression:values[i][1],bluffing:values[i][2],betSize:values[i][3]}}));
export function validPlayers(v:unknown):v is Player[] {
 if(!Array.isArray(v)||v.length!==8)return false;
 return v.every(p=>p && typeof p.name==='string' && p.name.trim().length>0 && p.name.trim().length<=32 && !/[\u0000-\u001f\u007f]/.test(p.name) && p.personality && ['selectiveness','aggression','bluffing','betSize'].every(k=>Number.isInteger(p.personality[k])&&p.personality[k]>=0&&p.personality[k]<=100));
}
