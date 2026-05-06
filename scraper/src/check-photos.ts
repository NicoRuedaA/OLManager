import fs from 'fs';
const world = JSON.parse(fs.readFileSync('output/world.json','utf-8'));
const existing = world.players.filter((p:any)=>p.photoId && fs.existsSync('output/player-photos/'+p.photoId+'.webp')).length;
const pending = world.players.filter((p:any)=>p.photoId && !fs.existsSync('output/player-photos/'+p.photoId+'.webp')).length;
console.log('Con foto YA:     '+existing);
console.log('Pendientes:      '+pending);
console.log('Total con photoId: '+(existing+pending));
const sample = world.players.filter((p:any)=>p.photoId && !fs.existsSync('output/player-photos/'+p.photoId+'.webp')).slice(0,100);
let hasUrl=0, noUrl=0;
for (const p of sample) {
  if (p.photoUrl) hasUrl++; else noUrl++;
}
console.log('\nMuestra de 100 pendientes:');
console.log('  Con URL conocida: '+hasUrl);
console.log('  Sin URL conocida:  '+noUrl);