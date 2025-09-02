export function createAgent(x,y,col){
  return {
    x,y,col,
    energy: 25,
    alive:true,
    exp:0,
    lvl:1,
    skills:{speed:1,strength:1,vision:1}
  };
}
