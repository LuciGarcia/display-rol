import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white font-sans p-6">
      <div className="max-w-xl text-center">
        <h1 className="text-4xl font-extrabold text-blue-500 mb-3">
          Generador de Planos & Simulador IA
        </h1>
        <p className="text-neutral-400 mb-8 text-sm">
          Sistema dinámico e interactivo de simulación para organizaciones,
          plantas industriales y escenarios adaptables.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/master"
            className="p-6 bg-neutral-900 border border-neutral-800 hover:border-blue-500 rounded-xl shadow-lg transition-all text-left group"
          >
            <span className="text-3xl mb-2 block">🎯</span>
            <h2 className="font-bold text-lg text-white group-hover:text-blue-400">
              Panel del Master
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Configura escenarios con IA, gestiona roles y controla áreas en
              tiempo real.
            </p>
          </Link>

          <Link
            href="/display/sesion1"
            className="p-6 bg-neutral-900 border border-neutral-800 hover:border-emerald-500 rounded-xl shadow-lg transition-all text-left group"
          >
            <span className="text-3xl mb-2 block">📺</span>
            <h2 className="font-bold text-lg text-white group-hover:text-emerald-400">
              Vista Display
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Pantalla de solo lectura para proyectores o espectadores
              sincronizada en vivo.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
