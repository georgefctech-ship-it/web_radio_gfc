import { Routes, Route } from 'react-router-dom';
import RadioPlayer from './pages/RadioPlayer';
import { LiveStudio } from './pages/LiveStudio';
import AdminAuth from './pages/AdminAuth';
import AdminDashboard from './pages/AdminDashboard';
import StationDetails from './pages/StationDetails';
import Podcasts from './pages/Podcasts';
import News from './pages/News';
import GuicheWeb from './pages/GuicheWeb';
import Support from './pages/Support';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RadioPlayer />} />
      <Route path="/station/:id" element={<StationDetails />} />
      <Route path="/admin" element={<AdminAuth />} />
      <Route path="/studio" element={<LiveStudio />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/podcasts" element={<Podcasts />} />
      <Route path="/news" element={<News />} />
      <Route path="/guiche-web" element={<GuicheWeb />} />
      <Route path="/support" element={<Support />} />
    </Routes>
  );
}
