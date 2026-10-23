import { Route, Routes } from "react-router-dom";
import { CheshireProject, PublicHome } from "./CheshireProject";
import { CheshireDashboard, CheshireLogin, CheshireMapPage, CheshireProtected, CheshireShell } from "./CheshirePortal";

export default function App() {
  return <Routes>
    <Route path="/" element={<PublicHome/>}/>
    <Route path="/cheshire" element={<CheshireLogin/>}/>
    <Route path="/cheshire/dashboard" element={<CheshireProtected><CheshireShell><CheshireDashboard/></CheshireShell></CheshireProtected>}/>
    <Route path="/cheshire/map" element={<CheshireProtected><CheshireShell><CheshireMapPage><CheshireProject/></CheshireMapPage></CheshireShell></CheshireProtected>}/>
    <Route path="*" element={<PublicHome/>}/>
  </Routes>;
}
