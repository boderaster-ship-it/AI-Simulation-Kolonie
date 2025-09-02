export function createColony(name,color,params){
  return {
    name,color,params,
    agents:[],
    score:0
  };
}
