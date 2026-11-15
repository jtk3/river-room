import {createGame,startHand,act,botView} from '../../public/game/engine/holdem.js';
import {chooseAction as oldBot} from '../../test/fixtures/bots-baseline.js';
import {chooseAction as newBot} from '../../public/game/engine/bots.js';
function seeded(seed){return ()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296)}
const rounds=Number(process.argv[2]||500),n=6;
let sum=0,sq=0,steps=0;const begin=performance.now();
for(let h=0;h<rounds;h++){
 const variant=h%2;const deckRng=seeded(100000+Math.floor(h/2));
 let s=createGame(n-1);for(const p of s.players)p.style='Balanced';
 s.button=(Math.floor(h/2)%n+n-1)%n;
 s=startHand(s,deckRng);const rngs=Array.from({length:n},(_,i)=>seeded(987654+Math.floor(h/2)*41+i));let actions=0;
 while(s.phase!=='complete'&&actions++<150){const i=s.actor, fn=(i%2===variant)?newBot:oldBot;const c=fn(botView(s,i),rngs[i]);s=act(s,i,c.action,c.amount);}
 if(s.phase!=='complete')throw new Error('Hand did not finish');
 let delta=0;for(const p of s.players)if(p.id%2===variant)delta+=p.stack-1000;
 sum+=delta/3;sq+=(delta/3)**2;steps+=actions;
}
const mean=sum/rounds,variance=Math.max(0,(sq-rounds*mean*mean)/Math.max(1,rounds-1)),se=Math.sqrt(variance/rounds);
console.log(JSON.stringify({hands:rounds,players:n,bbPer100:mean/10*100,interval95:[(mean-1.96*se)/10*100,(mean+1.96*se)/10*100],seconds:(performance.now()-begin)/1000,meanActions:steps/rounds}));
