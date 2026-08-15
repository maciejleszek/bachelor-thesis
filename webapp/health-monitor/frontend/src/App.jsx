import { BrowserRouter, Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import SyncStatus from "./components/SyncStatus";
import Dashboard from "./pages/Dashboard";
import Survey from "./pages/Survey";
import History from "./pages/History";
import Data from "./pages/Data";
import Sport from "./pages/Sport";
import Analysis from "./pages/Analysis";
import Sleep from "./pages/Sleep";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <SyncStatus />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/survey" element={<Survey />} />
          <Route path="/history" element={<History />} />
          <Route path="/data" element={<Data />} />
          <Route path="/sport" element={<Sport />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/sleep" element={<Sleep />} />
        </Routes>
        <NavBar />
      </div>
    </BrowserRouter>
  );
}
