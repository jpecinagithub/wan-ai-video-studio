import { Route, Routes } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { Layout } from './components/Layout';
import { ThemeProvider } from './hooks/useTheme';
import { Studio } from './pages/Studio';
import { MisVideos } from './pages/MisVideos';
import { Biblioteca } from './pages/Biblioteca';
import { AcercaDe } from './pages/AcercaDe';

function NoEncontrada() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-2xl font-bold">Página no encontrada</h1>
      <p className="mt-2 text-sm text-muted">
        La dirección que buscas no existe. Vuelve al estudio para seguir creando.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Studio />} />
          <Route path="/mis-videos" element={<MisVideos />} />
          <Route path="/biblioteca" element={<Biblioteca />} />
          <Route path="/acerca-de" element={<AcercaDe />} />
          <Route path="*" element={<NoEncontrada />} />
        </Routes>
      </Layout>
      <Analytics />
    </ThemeProvider>
  );
}
