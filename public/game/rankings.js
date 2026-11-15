const status = document.getElementById('status'), body = document.getElementById('rankings');
try {
 const response = await fetch('/api/rankings',{cache:'no-store'});if(!response.ok)throw new Error('Unable to load the rankings.');const data=await response.json();
 for(const p of data.players){const row=document.createElement('tr');for(const value of [`${p.name}${p.kind==='bot'?' (computer)':''}`,Number(p.net).toLocaleString(),Number(p.hands).toLocaleString(),(p.net*100/p.hands).toLocaleString(undefined,{maximumFractionDigits:1})]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}body.append(row);}
 status.textContent=data.players.length?'':'No results yet. Play a hand to start the record.';
}catch(e){status.textContent=e.message;}
