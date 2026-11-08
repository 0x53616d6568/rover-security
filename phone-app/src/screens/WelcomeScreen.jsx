import { motion } from "framer-motion";

export default function WelcomeScreen({ onLaunch }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-deep to-ink p-8 text-text-primary shadow-xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_30%,rgba(74,222,128,0.18),transparent_55%)]" />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <motion.img
          src="/rover.svg"
          alt="Rover"
          className="h-56 w-auto drop-shadow-2xl"
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="text-center">
          <h1 className="text-4xl font-light">Smart</h1>
          <div className="mt-1 flex items-center justify-center gap-3">
            <h2 className="text-4xl font-bold">Exploration</h2>
            <div className="h-8 w-8 overflow-hidden rounded-full border border-white/20 bg-white/10">
              <img src="/rover.svg" alt="" className="h-full w-full object-cover" />
            </div>
          </div>
          <h2 className="mt-1 text-4xl font-semibold italic">Data Analysis</h2>
          <p className="mt-3 text-sm text-text-secondary">RoverX Console — autonomous ground robotics</p>
        </div>
        <button
          onClick={onLaunch}
          className="rounded-full bg-green-400/90 px-8 py-3 text-sm font-semibold text-deep shadow-lg"
        >
          Launch
        </button>
      </div>
    </section>
  );
}
