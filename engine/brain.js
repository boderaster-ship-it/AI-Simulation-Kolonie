// vereinfachte Policy: Kolonie-Parameter steuern Verhalten
export function decide(agent, world, colony){
  // Hunger treibt Suche nach Ressourcen
  if(agent.energy<15) return 'EAT';
  // Räuber jagen eher Gegner
  if(colony.params.aggro>0.8) return Math.random()<0.6?'ATTACK':'MOVE';
  // Sammler sammeln mehr
  return Math.random()<0.6?'EAT':'MOVE';
}
