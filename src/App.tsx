import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { CheshireProject, PublicHome } from "./CheshireProject";
import { CheshireDashboard, CheshireLogin, CheshireMapPage, CheshireProtected, CheshireShell } from "./CheshirePortal";

const SamplePreview = import.meta.env.DEV ? lazy(() => import("./cheshire/CheshireSamplePreview")) : null;

export default function App() {
  return <Routes>
    <Route path="/" element={<PublicHome/>}/>
    <Route path="/cheshire" element={<CheshireLogin/>}/>
    <Route path="/cheshire/dashboard" element={<CheshireProtected><CheshireShell><CheshireDashboard/></CheshireShell></CheshireProtected>}/>
    <Route path="/cheshire/map" element={<CheshireProtected><CheshireShell><CheshireMapPage><CheshireProject/></CheshireMapPage></CheshireShell></CheshireProtected>}/>
    {SamplePreview ? <Route path="/cheshire/preview" element={<Suspense fallback={<main className="cfz-gate"><p>Opening the sample dashboard…</p></main>}><SamplePreview/></Suspense>}/> : null}
    <Route path="*" element={<PublicHome/>}/>
  </Routes>;
}
