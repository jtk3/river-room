import { TRAITS, validateRoster } from '../engine/player-settings.js';
const labels = {selectiveness:'Selectiveness',aggression:'Aggression',bluffing:'Bluffing',betSize:'Bet size'};
const editor = document.getElementById('editor');
const status = document.getElementById('status');
const players = document.getElementById('players');
let version = null;
function setStatus(message) { status.textContent = message; }
function draw(roster) {
  players.replaceChildren();
  for (const [i, p] of roster.entries()) {
    const card = document.createElement('section'); card.className = 'admin-card';
    const title = document.createElement('h2'); title.textContent = `Player ${i + 1}`; card.append(title);
    const nameLabel = document.createElement('label'); nameLabel.textContent = 'Name';
    const name = document.createElement('input'); name.type='text'; name.name=`name-${i}`; name.maxLength=32; name.required=true; name.value=p.name; nameLabel.append(name); card.append(nameLabel);
    for (const trait of TRAITS) {
      const label = document.createElement('label'); label.textContent = labels[trait];
      const output = document.createElement('output'); output.textContent = p.personality[trait]; label.append(output);
      const input = document.createElement('input'); input.type='range'; input.min='0'; input.max='100'; input.step='1'; input.name=`${trait}-${i}`; input.value=p.personality[trait]; input.setAttribute('aria-label',`${labels[trait]} for player ${i+1}`);
      input.addEventListener('input', () => { output.textContent = input.value; }); label.append(input); card.append(label);
    }
    players.append(card);
  }
}
function readRoster() {
  const data = new FormData(editor);
  return validateRoster(Array.from({length:8}, (_,i) => ({name: data.get(`name-${i}`), personality: Object.fromEntries(TRAITS.map(t => [t, Number(data.get(`${t}-${i}`))]))})));
}
async function request(path, options) {
  const response = await fetch(path, {...options, credentials:'same-origin', headers:{'Content-Type':'application/json',...(options?.headers||{})}});
  if (!response.ok) { const body = await response.json().catch(() => ({})); const error = new Error(body.error || `Request failed (${response.status})`); error.status=response.status; throw error; }
  return response.json();
}
async function load() {
  try { const data = await request('/api/admin/players'); version=data.version; draw(validateRoster(data.players)); editor.hidden=false; setStatus('Ready.'); }
  catch(e) { editor.hidden=true; document.getElementById('auth').hidden=e.status!==401; setStatus(e.status===401?'Please sign in using the owner account.':e.status===403?'This account cannot edit River Room.':`Unable to load the player settings: ${e.message}`); }
}
editor.addEventListener('submit', async e => { e.preventDefault(); try { const roster=readRoster(); const result=await request('/api/admin/players',{method:'PUT',body:JSON.stringify({version,players:roster})}); version=result.version; draw(validateRoster(result.players)); setStatus('Saved. New tables will use these settings.'); } catch(err){setStatus(`Not saved: ${err.message}`);} });
document.getElementById('restore').addEventListener('click', async () => { try { const defaults=await request('/api/admin/default-players'); draw(validateRoster(defaults.players)); setStatus('Defaults loaded. Select Save all players to apply them.'); } catch(err){setStatus(`Could not load defaults: ${err.message}`);} });
load();
