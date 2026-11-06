import { useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

export function CheshirePortalNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    // Preserve earlier bookmarks while moving operational reviews off the dashboard.
    if (location.pathname === '/cheshire/dashboard' && location.hash === '#csd-source-review') navigate('/cheshire/data', { replace: true });
  }, [location.pathname, location.hash, navigate]);
  return <nav className="cfz-nav" aria-label="Cheshire portal">
    <NavLink to="/cheshire/dashboard">Dashboard</NavLink>
    <NavLink to="/cheshire/map">Profitability map</NavLink>
    <NavLink to="/cheshire/data">Data requests</NavLink>
  </nav>;
}
