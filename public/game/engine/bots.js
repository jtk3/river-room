import { evaluate, rank, suit, random } from "./cards.js";
import { personalityToProfile } from "./player-settings.js";

const PROFILES = {
  "Tight aggressive": {edge:0.08, aggression:0.6, bluff:0.035, sizing:0.65},
  "Loose aggressive": {edge:-0.05, aggression:0.8, bluff:0.15, sizing:0.8},
  "Calling station": {edge:-0.14, aggression:0.13, bluff:0.01, sizing:0.4},
  Rock: {edge:0.16, aggression:0.3, bluff:0.005, sizing:0.65},
  Balanced: {edge:0.01, aggression:0.48, bluff:0.06, sizing:0.6},
  Maniac: {edge:-0.1, aggression:0.92, bluff:0.27, sizing:1.1},
  Tricky: {edge:0.02, aggression:0.55, bluff:0.12, sizing:0.55},
  Casual: {edge:-0.06, aggression:0.28, bluff:0.05, sizing:0.5},
};
const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));

// Lightweight starting-hand estimate, not a solved hand chart.
export function startingStrength(hole) {
  const [a,b]=hole, hi=Math.max(rank(a),rank(b)),lo=Math.min(rank(a),rank(b));
  if(hi===lo) return 0.56 + 0.42*(hi-2)/12;
  const gap=hi-lo;
  const suited=suit(a)===suit(b) ? 0.055 : 0;
  const connected=gap===1 ? 0.045 : gap===2 ? 0.025 : 0;
  const broadway=hi>=10 && lo>=10 ? 0.04 : 0;
  return clamp(0.49*(hi/14)+0.23*(lo/14)+suited+connected+broadway,0,1);
}

// Position among all occupied seats: 0 is earliest, 1 is latest.
// A legacy saved hand may lack a button/history; use a neutral default.
export function positionScore(view, id=view.id) {
  const n=view.players.length;
  if(!Number.isInteger(view.button)||n<2)return 0.5;
  const order=[];
  const start=view.phase==='preflop'?(view.button+(n===2?0:3))%n:(view.button+1)%n;
  for(let i=0;i<n;i++)order.push((start+i)%n);
  const index=order.indexOf(id);
  return index<0?0.5:index/(n-1);
}

function drawValue(hole, board) {
  const cards=[...hole,...board];
  const groups=Array.from({length:4},(_,i)=>cards.filter(c=>suit(c)===i).length);
  const flushDraw=groups.some(x=>x===4) ? 0.10 : 0;
  const values=new Set(cards.map(rank));if(values.has(14))values.add(1);
  let four=false;for(let i=1;i<=10;i++)if([0,1,2,3,4].filter(j=>values.has(i+j)).length===4)four=true;
  return flushDraw+(four?0.07:0);
}
function boardStrength(hole,board){
  if(board.length<3)return startingStrength(hole);
  const category=evaluate([...hole,...board]).category;
  const made=[0.18,0.43,0.68,0.79,0.86,0.9,0.94,0.98,1][category];
  const boardHasPair=new Set(board.map(rank)).size<board.length;
  return clamp(made+(category===1&&boardHasPair?-0.12:0)+(board.length<5?drawValue(hole,board):0),0,1);
}

// Weight candidate hands by public actions, while always leaving some room for
// unusual holdings and bluffs. This is a heuristic, not opponent mind-reading.
export function rangeWeight(hole, actions, bigBlind=10) {
  let weight=1;
  for(const a of actions){
    if(a.action!=='raise'&&a.action!=='call')continue;
    const size=a.action==='raise'?Math.max(0,a.amount-a.playerBet):a.amount;
    const pressure=clamp(size/Math.max(a.potBefore,bigBlind,1),0,3);
    const strength=a.street==='preflop'?startingStrength(hole):boardStrength(hole,a.board||[]);
    const threshold=a.street==='preflop'
      ? (a.action==='raise'?0.48:0.39)+Math.min(pressure,2)*0.045
      : (a.action==='raise'?0.45:0.32)+Math.min(pressure,2)*0.08;
    const fit=1/(1+Math.exp(-9*(strength-threshold)));
    weight *= 0.32+0.68*fit;
  }
  return clamp(weight,0.08,1);
}

function take(deck,rng){const i=Math.floor(rng()*deck.length);return deck.splice(i,1)[0];}
export function estimateEquity(view,rng=random,samples=120) {
  const known=new Set([...view.hole,...view.board]);
  const unknown=Array.from({length:52},(_,i)=>i).filter(c=>!known.has(c));
  const opponents=view.players.filter(p=>p.id!==view.id&&!p.folded);
  const histories=new Map(opponents.map(p=>[p.id,(view.actionHistory||[]).filter(a=>a.playerId===p.id)]));
  let equity=0;
  for(let sample=0;sample<samples;sample++){
    const deck=[...unknown],hands=[];
    for(const p of opponents){
      let pair;
      for(let tries=0;tries<8;tries++){
        pair=[take(deck,rng),take(deck,rng)];
        if(tries===7||rng()<rangeWeight(pair,histories.get(p.id),view.bigBlind))break;
        deck.push(...pair);
      }
      hands.push(pair);
    }
    const board=[...view.board];while(board.length<5)board.push(take(deck,rng));
    const ours=evaluate([...view.hole,...board]).score;
    let ties=1,beaten=false;
    for(const hand of hands){const theirs=evaluate([...hand,...board]).score;if(theirs>ours){beaten=true;break;}if(theirs===ours)ties++;}
    if(!beaten)equity+=1/ties;
  }
  return equity/samples;
}

export function chooseAction(view,rng=random){
  const me=view.players.find(p=>p.id===view.id),legal=view.legal;
  if(!me||!legal)throw new Error("No legal bot action");
  const profile=me.personality?personalityToProfile(me.personality):(PROFILES[me.style]||PROFILES.Balanced);
  const rivals=view.players.filter(p=>p.id!==view.id&&!p.folded);
  const position=positionScore(view), history=view.actionHistory||[];
  const streetRaises=history.filter(a=>a.street===view.phase&&a.action==='raise');
  const odds=legal.call/(view.pot+legal.call||1);
  const equity=estimateEquity(view,rng);
  const noise=(rng()-0.5)*0.045;
  let value=equity+noise-profile.edge*0.65;
  const sizePressure=legal.toCall/Math.max(view.pot,view.bigBlind,1);
  const effectiveStack=Math.min(me.stack,...rivals.map(p=>p.stack+p.bet));
  const shortStack=effectiveStack/view.bigBlind<20;
  const preflop=view.phase==='preflop';
  const handQuality=preflop?startingStrength(view.hole):boardStrength(view.hole,view.board);
  // Earlier seats and previous raises demand stronger starting hands. Personality
  // shifts selectiveness; short stacks tighten speculative calls, not all play.
  const preThreshold=clamp(0.37+(1-position)*0.10+Math.min(streetRaises.length,2)*0.055+clamp(profile.edge,-0.16,0.16)*0.35+(shortStack?0.02:0),0.24,0.72);
  const tooWeakPreflop=preflop&&legal.toCall>0&&handQuality<preThreshold;
  const multiway=rivals.length>1;
  const hasDraw=!preflop&&view.board.length<5&&drawValue(view.hole,view.board)>0;
  const pressurePenalty=clamp(sizePressure,0,2)*0.025;
  const positionalBonus=(position-0.5)*0.025;
  value+=positionalBonus-pressurePenalty;
  const valueRaise=preflop?handQuality>preThreshold+0.13:value>Math.max(0.48,odds+0.18);
  // Prefer bluffs with outs or useful blockers, fewer opponents, and less
  // pressure. Personalities remain distinct through their bluff sliders.
  const credibleBluff=preflop?handQuality>preThreshold-0.02:(hasDraw||view.hole.some(c=>rank(c)===14));
  const bluffChance=profile.bluff*(multiway?0.35:1)*(streetRaises.length?0.35:1)*(position<0.4?0.7:1);
  const bluff=credibleBluff&&rng()<bluffChance;
  if(legal.canRaise&&((valueRaise&&rng()<profile.aggression)||bluff)){
    const textureFactor=multiway?0.82:1;
    const sizing=clamp(profile.sizing*textureFactor*(hasDraw?0.85:1),0.15,1.5);
    let amount=Math.max(legal.fullRaiseTo,me.bet+legal.toCall+Math.round((view.pot+legal.call)*sizing));
    if(equity>0.9&&rng()<0.12)amount=legal.maxRaiseTo;
    return {action:'raise',amount:Math.min(legal.maxRaiseTo,amount)};
  }
  if(legal.check)return {action:'check'};
  if(!tooWeakPreflop&&(value>=odds+(multiway?0.025:0)|| (legal.call<=view.bigBlind&&rng()<0.08)))return {action:'call'};
  return {action:'fold'};
}
