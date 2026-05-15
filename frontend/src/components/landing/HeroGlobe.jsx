import { motion, useReducedMotion } from "framer-motion";

import heroGlobeImage from "@/assets/landing/ecogrid-hero-globe.png";

function HeroMedia({ media }) {
  if (media?.type === "video") {
    return (
      <video
        aria-hidden="true"
        autoPlay
        className="h-full w-full object-cover object-center"
        loop
        muted
        playsInline
        poster={media.poster}
        src={media.src}
      />
    );
  }

  if (media?.type === "custom") {
    return media.node;
  }

  return (
    <img
      alt=""
      aria-hidden="true"
      className="h-full w-full object-cover object-center"
      decoding="async"
      src={media?.src || heroGlobeImage}
    />
  );
}

export function HeroGlobe({ media = { type: "image", src: heroGlobeImage } }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(34,211,238,0.18),transparent_30%),linear-gradient(180deg,#f8fbff_0%,#eaf3f8_45%,#ffffff_100%)] dark:bg-[radial-gradient(circle_at_50%_18%,rgba(34,211,238,0.20),transparent_32%),linear-gradient(180deg,#01040a_0%,#03111d_52%,#02050c_100%)]" />
      <motion.div
        animate={
          reduceMotion
            ? undefined
            : {
                scale: [1, 1.018, 1],
                y: [0, -12, 0],
              }
        }
        className="absolute inset-0 opacity-95"
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      >
        <HeroMedia media={media} />
      </motion.div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,transparent_0%,transparent_36%,rgba(255,255,255,0.24)_78%,rgba(255,255,255,0.72)_100%)] dark:bg-[radial-gradient(circle_at_50%_34%,transparent_0%,transparent_48%,rgba(2,5,12,0.28)_84%,#02050c_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/76 dark:from-black/20 dark:via-transparent dark:to-[#02050c]/86" />
      <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-white via-white/75 to-transparent dark:from-[#02050c] dark:via-[#02050c]/70" />
      <div className="absolute inset-0 opacity-45 [background-image:radial-gradient(circle_at_center,rgba(15,23,42,0.18)_1px,transparent_1.4px)] [background-size:82px_82px] dark:opacity-35 dark:[background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.48)_1px,transparent_1.4px)]" />
      <div className="absolute left-1/2 top-[22%] size-[36rem] -translate-x-1/2 rounded-full bg-cyan-300/20 blur-[110px] dark:bg-cyan-400/18" />
      <div className="absolute bottom-[-10rem] left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-emerald-300/20 blur-[120px] dark:bg-emerald-400/10" />
    </div>
  );
}
