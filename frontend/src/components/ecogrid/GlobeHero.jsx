import { HexGridOverlay } from "./HexGridOverlay";

export function GlobeHero() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(14,165,233,0.22),transparent_34%),linear-gradient(180deg,#020712_0%,#04111f_48%,#020712_100%)]" />
      <div className="absolute inset-0 opacity-55 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.65)_1px,transparent_1.5px)] [background-size:92px_92px]" />
      <div className="absolute left-1/2 top-[18%] h-[62rem] w-[92rem] -translate-x-1/2 rounded-[50%] border border-cyan-200/22 bg-[radial-gradient(circle_at_50%_24%,rgba(186,230,253,0.72),rgba(14,165,233,0.32)_18%,rgba(16,185,129,0.18)_34%,rgba(15,23,42,0.92)_58%,rgba(2,6,23,0.98)_72%)] shadow-[0_0_80px_rgba(56,189,248,0.38),inset_0_0_90px_rgba(14,165,233,0.24)] sm:top-[16%]" />
      <div className="absolute left-1/2 top-[22%] h-[44rem] w-[76rem] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(circle_at_28%_45%,rgba(250,204,21,0.26),transparent_12%),radial-gradient(circle_at_61%_34%,rgba(34,197,94,0.24),transparent_15%),radial-gradient(circle_at_74%_57%,rgba(168,85,247,0.22),transparent_13%)] opacity-80 blur-sm" />
      <HexGridOverlay />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#020712] via-[#020712]/78 to-transparent" />
    </div>
  );
}
