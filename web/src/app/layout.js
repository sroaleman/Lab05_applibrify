import Navbar from '@/components/Navbar';
import { AuthProvider } from '@/context/AuthContext';
import './globals.css';

export const metadata = {
  title: 'Librify - Tu Biblioteca Digital y Física',
  description: 'Catálogo editorial de libros digitales y físicos',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="min-h-screen flex flex-col bg-paper text-coffee antialiased selection:bg-gold/30 selection:text-coffee">
        <AuthProvider>
          <Navbar />
          <main className="flex-1 w-full">{children}</main>
          <footer className="bg-coffee text-paper border-t border-brown/30 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <div className="flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0">
                <div className="text-center md:text-left">
                  <span className="font-serif text-2xl font-bold tracking-wide text-paper">
                    Librify
                  </span>
                  <p className="text-sm text-paper/70 font-serif italic mt-1">
                    Lectura para todos.
                  </p>
                </div>
                <div className="h-px w-24 bg-gold/40 md:hidden"></div>
                <div className="text-center md:text-right text-xs text-paper/60 space-y-1">
                  <p>© {new Date().getFullYear()} Librify. Todos los derechos reservados.</p>
                  <p className="text-paper/40">Obras impresas y ediciones digitales protegidas.</p>
                </div>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
