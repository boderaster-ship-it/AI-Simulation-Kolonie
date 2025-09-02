export function bindUI(sim){
  const panel=document.getElementById('panel');
  const btnStart=document.getElementById('btnStart');
  const btnStop=document.getElementById('btnStop');
  const btnPause=document.getElementById('btnPause');
  const btnResume=document.getElementById('btnResume');

  btnStart.onclick=()=>{panel.style.display='none';sim.start();};
  btnStop.onclick=()=>{sim.stop();panel.style.display='block';};
  btnPause.onclick=()=>{sim.stop();};
  btnResume.onclick=()=>{panel.style.display='none';sim.start();};
}
