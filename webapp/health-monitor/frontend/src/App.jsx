import { BrowserRouter, Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import Dashboard from "./pages/Dashboard";
import Survey from "./pages/Survey";
import History from "./pages/History";
import Data from "./pages/Data";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/survey" element={<Survey />} />
          <Route path="/history" element={<History />} />
          <Route path="/data" element={<Data />} />
        </Routes>
        <NavBar />
      </div>
    </BrowserRouter>
  );
}
