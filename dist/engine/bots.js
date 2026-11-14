import { evaluate, shuffled, rank, suit, random } from './cards.js';
const PROFILES = {
  'Tight aggressive': {edge:.08, aggression:.6, bluff:.035, sizing:.65},
  'Loose aggressive': {edge:-.05, aggression:.8, bluff:.15, sizing:.8},
  'Calling station': {edge:-.14, aggression:.13, bluff:.01, sizing:.4},
  'Rock': {edge:.16, aggression:.3, bluff:.005, sizing:.65},
  'Balanced': {edge:.01, aggression:.48, bluff:.06, sizing:.6},
  'Maniac': {edge:-.1, aggression:.92, bluff:.27, sizing:1.1},
  'Tricky': {edge:.02, aggression:.55, bluff:.12, sizing:.55},
  'Casual': {edge:-.06, aggression:.28, bluff:.05, sizing:.5}
};
export function estimateEquity(view, rng=random, samples=72) {
  const known=new Set([...view.hole,...view.board]);
  const unseen=Array.from({length:52},(_,i)=>i).filter(c=>!known.has(c));
  const opponents=view.players.filter(p=>p.id!==view.id&&!p.folded).length;
  let equity=0;
  for(let i=0;i<samples;i++) {
    const deck=shuffled(unseen,rng), board=[...view.board];while(board.length<5)board.push(deck.pop());
    const hero=evaluate([...view.hole,...board]).score;
    let ties=1, beaten=false;
    for(let j=0;j<opponents;j++) {const v=evaluate([deck.pop(),deck.pop(),...board]).score;if(v>hero){beaten=true;break;}if(v===hero)ties++;}
    if(!beaten) equity+=1/ties;
  }
  return equity/samples;
}
export function chooseAction(view,rng=random) {
  const p=view.players.find(p=>p.id===view.id), profile=PROFILES[p.style]||PROFILES.Balanced;
  const l=view.legal;if(!l)throw new Error('No legal bot action');
  let equity=estimateEquity(view,rng);
  // Small preflop preference for playable, connected hands.
  if(view.board.length===0) {
    const [a,b]=view.hole;
    if(suit(a)===suit(b))equity+=.025;
    if(Math.abs(rank(a)-rank(b))===1)equity+=.015;
  }
  const odds=l.call/(view.pot+l.call||1), noise=(rng()-.5)*.07;
  const value=equity+noise-profile.edge;
  const bluff=rng()<profile.bluff;
  if(l.canRaise && ((value>Math.max(.43,odds+.2) && rng()<profile.aggression)||bluff)) {
    let amount=Math.max(l.fullRaiseTo, p.bet+l.toCall+Math.round((view.pot+l.call)*profile.sizing));
    if(equity>.85&&rng()<.25)amount=l.maxRaiseTo;
    return {action:'raise',amount:Math.min(l.maxRaiseTo,amount)};
  }
  if(l.check)return {action:'check'};
  if(value>=odds || (l.call<=view.bigBlind&&rng()<.16))return {action:'call'};
  return {action:'fold'};
}
