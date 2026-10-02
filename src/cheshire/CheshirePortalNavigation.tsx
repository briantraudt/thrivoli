import { useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

const dashboardPath='/cheshire/dashboard';
const requestsHash='#csd-source-review';
function revealRequests(){
 const panel=document.getElementById('csd-source-review');
 if(!(panel instanceof HTMLDetailsElement))return;
 panel.open=true;
 panel.querySelector('summary')?.focus({preventScroll:true});
 panel.scrollIntoView?.({behavior:'smooth',block:'start'});
}
export function CheshirePortalNavigation(){
 const location=useLocation();
 const requests=location.pathname===dashboardPath&&location.hash===requestsHash;
 useEffect(()=>{
  if(requests)revealRequests();
  else if(location.pathname===dashboardPath){
   document.getElementById('cheshire-financial-summary')?.scrollIntoView?.({block:'start'});
  }
 },[requests,location.pathname,location.key]);
 return <nav className="cfz-nav" aria-label="Cheshire portal">
  <Link to={dashboardPath} className={location.pathname===dashboardPath&&!requests?'active':undefined} aria-current={location.pathname===dashboardPath&&!requests?'page':undefined}>Dashboard</Link>
  <NavLink to="/cheshire/map">Profitability map</NavLink>
  <Link to={`${dashboardPath}${requestsHash}`} className={requests?'active':undefined} aria-current={requests?'page':undefined} onClick={()=>{if(requests)revealRequests();}}>Data requests</Link>
 </nav>;
}
