/** Lightweight preformatted ASCII frame loops — biology-themed, monochrome.
 * Shark-style: fixed canvas, smooth motion, recognizable silhouettes.
 * Timings are tuned for loaders + demo video transition beats.
 */

export type AsciiClipId =
  | "amoeba"
  | "mitosis"
  | "colonies"
  | "phage"
  | "pipette";

export type AsciiClip = {
  id: AsciiClipId;
  label: string;
  /** ms between frames */
  intervalMs: number;
  /** full loop duration ≈ frames.length * intervalMs */
  frames: string[];
  /** suggested video hold (ms) for a full readable beat */
  videoHoldMs: number;
};

/** Amoeba crawling / pseudopod extension — nucleus drifts, foot reaches */
export const AMOEBA: AsciiClip = {
  id: "amoeba",
  label: "amoeba",
  intervalMs: 140,
  videoHoldMs: 2800,
  frames: [
    `
      .--.
   .-'    '-.
  /  (o)  .  \\
  \\    .     /
   '-.____.-'
`,
    `
       .--.
    .-'    '-.
   / .(o)  .  \\
   \\     .    /
    '-.____.-'
`,
    `
        .--.
     .-'    '-.
    / .(o).    \\_
    \\    .     /
     '-.____.-'
`,
    `
         .--.
      .-'    '-.__
     / .(o).      \\
     \\    .   ___/
      '-.____.-'
`,
    `
          .--.
       .-'    '-.___
      /  .(o).       \\
      \\      .   ____/
       '-.____.-'
`,
    `
           .--.
        .-'    '-.__
       /   .(o)      \\
       \\       . ____/
        '-.____.-'
`,
    `
          .--.
       .-'    '-.
      /   .(o).  \\__
      \\      .   /
       '-.____.-'
`,
    `
        .--.
     .-'    '-.
    /  .(o).   \\
    \\     .  ./
     '-.____.-'
`,
    `
      .--.
   .-'    '-.
  /  .(o).   \\
  \\    .     /
   '-.____.-'
`,
    `
     .--.
  .-'    '-.
 /  (o). .  \\
 \\    .     /
  '-.____.-'
`,
  ],
};

/** Cell division (mitosis) — compact → elongate → split → daughters */
export const MITOSIS: AsciiClip = {
  id: "mitosis",
  label: "mitosis",
  intervalMs: 180,
  videoHoldMs: 3200,
  frames: [
    `
      .------.
     /  ····  \\
    |  · XX ·  |
     \\  ····  /
      '------'
`,
    `
      .------.
     / · ··· ·\\
    | · X  X · |
     \\ ··· ·  /
      '------'
`,
    `
     .--------.
    /  · · · · \\
   |  · X··X ·  |
    \\  · · · · /
     '--------'
`,
    `
    .----.  .----.
   / ·X·  \\/  ·X· \\
  |  ···   ||   ··· |
   \\      /\\      /
    '----'  '----'
`,
    `
   .----.    .----.
  / ·X· \\    / ·X· \\
 |  ···  |  |  ···  |
  \\     /    \\     /
   '----'    '----'
`,
    `
  .----.      .----.
 / ·X· \\      / ·X· \\
|  ···  |    |  ···  |
 \\     /      \\     /
  '----'      '----'
`,
    `
   .----.    .----.
  / ··· \\    / ··· \\
 | · X · |  | · X · |
  \\ ··· /    \\ ··· /
   '----'    '----'
`,
    `
    .----.  .----.
   / ··· \\  / ··· \\
  | · X · || · X · |
   \\ ··· /  \\ ··· /
    '----'  '----'
`,
  ],
};

/** Bacterial colonies blooming on a petri dish */
export const COLONIES: AsciiClip = {
  id: "colonies",
  label: "colonies",
  intervalMs: 160,
  videoHoldMs: 3000,
  frames: [
    `
      .-----------.
     /             \\
    |       ·       |
    |               |
     \\_____________/
`,
    `
      .-----------.
     /             \\
    |   ·   ·       |
    |       ·       |
     \\_____________/
`,
    `
      .-----------.
     /    ·        \\
    |   ··  ·       |
    |  ·   ··       |
     \\_____________/
`,
    `
      .-----------.
     / ··    ··    \\
    |  ···  ·· ·    |
    | · ···  ··     |
     \\_____________/
`,
    `
      .-----------.
     /··  ··· ··   \\
    | ····· ···· ·  |
    |·· ····· ··    |
     \\_____________/
`,
    `
      .-----------.
     /···••••··· · \\
    |•••• ···•····  |
    |··•····•···•·  |
     \\_____________/
`,
    `
      .-----------.
     /··••••••···• \\
    |•••••·•••••••• |
    |•·•••••••·•••• |
     \\_____________/
`,
    `
      .-----------.
     / ·•····•·· · \\
    | ···· •···· ·  |
    |  · ···· ··    |
     \\_____________/
`,
  ],
};

/** Bacteriophage — classic T4 silhouette swimming / docking */
export const PHAGE: AsciiClip = {
  id: "phage",
  label: "phage",
  intervalMs: 120,
  videoHoldMs: 2600,
  frames: [
    `
   ┌──┐
   │██│
   └──┘
    ||
   /  \\
  ·    ·
`,
    `
    ┌──┐
    │██│
    └──┘
     ||
    /  \\
   ·    ·
`,
    `
     ┌──┐
     │██│
     └──┘
      ||
     /  \\
    ·    ·
`,
    `
      ┌──┐
      │██│
      └──┘
       ||
      /||\\
     ·    ·
`,
    `
       ┌──┐
       │██│
       └──┘
        ||
       /||\\
      · || ·
`,
    `
        ┌──┐
        │██│
        └──┘
         ||
        /||\\
       · || ·
         ::
`,
    `
         ┌──┐
         │██│
         └──┘
          ||
         /||\\
        · || ·
          ::
          ..
`,
    `
       ┌──┐
       │██│
       └──┘
        ||
       /||\\
      · || ·
        ::
`,
    `
     ┌──┐
     │██│
     └──┘
      ||
     /  \\
    ·    ·
`,
    `
   ┌──┐
   │██│
   └──┘
    ||
   /  \\
  ·    ·
`,
  ],
};

/** Pipette drip — report / write beat */
export const PIPETTE: AsciiClip = {
  id: "pipette",
  label: "pipette",
  intervalMs: 130,
  videoHoldMs: 2400,
  frames: [
    `
      ||
     /||\\
    / || \\
      ||
      ||
      ||



`,
    `
      ||
     /||\\
    / || \\
      ||
      ||
      ||
      ·

`,
    `
      ||
     /||\\
    / || \\
      ||
      ||
      ||

      o
`,
    `
      ||
     /||\\
    / || \\
      ||
      ||
      ||


      ◦
`,
    `
      ||
     /||\\
    / || \\
      ||
      ||
      ||



`,
    `
      ||
     /||\\
    / || \\
      ||
      ||
      ||
      ·

`,
    `
      ||
     /||\\
    / || \\
      ||
      ||
      ||

      ·
`,
    `
      ||
     /||\\
    / || \\
      ||
      ||
      ||


      .
`,
  ],
};

export const ASCII_CLIPS: Record<AsciiClipId, AsciiClip> = {
  amoeba: AMOEBA,
  mitosis: MITOSIS,
  colonies: COLONIES,
  phage: PHAGE,
  pipette: PIPETTE,
};

export type AsciiContext =
  | "idle"
  | "extract"
  | "compute"
  | "verify"
  | "report"
  | "think"
  | "rotate";

/** Map pipeline / loading / Wonder-thinking context → clip */
export function clipForContext(context: AsciiContext, tick = 0): AsciiClipId {
  switch (context) {
    case "extract":
      return "colonies";
    case "compute":
      return "amoeba";
    case "verify":
      return "mitosis";
    case "report":
      return "pipette";
    case "think":
      return "phage";
    case "rotate": {
      const order: AsciiClipId[] = [
        "amoeba",
        "mitosis",
        "colonies",
        "phage",
        "pipette",
      ];
      return order[tick % order.length];
    }
    default:
      return "colonies";
  }
}

/** Video transition cue sheet — which clip to hold at each demo beat */
export const VIDEO_ASCII_CUES = [
  {
    beat: "title",
    clip: "colonies" as AsciiClipId,
    holdMs: COLONIES.videoHoldMs,
    note: "Title card: colonies blooming beside Slant figlet",
  },
  {
    beat: "hero-idle",
    clip: "amoeba" as AsciiClipId,
    holdMs: AMOEBA.videoHoldMs,
    note: "Hero corner loop while CTA sits",
  },
  {
    beat: "wonder-dispatch",
    clip: "phage" as AsciiClipId,
    holdMs: PHAGE.videoHoldMs,
    note: "Agent thinking / Wonder dispatch — phage docks",
  },
  {
    beat: "colony-cfu",
    clip: "colonies" as AsciiClipId,
    holdMs: COLONIES.videoHoldMs,
    note: "Loader during SAM colony extract",
  },
  {
    beat: "compute",
    clip: "amoeba" as AsciiClipId,
    holdMs: AMOEBA.videoHoldMs,
    note: "CFU math / calc agent — amoeba crawl",
  },
  {
    beat: "verify",
    clip: "mitosis" as AsciiClipId,
    holdMs: MITOSIS.videoHoldMs,
    note: "Verifier / protocol check — mitosis split",
  },
  {
    beat: "report",
    clip: "pipette" as AsciiClipId,
    holdMs: PIPETTE.videoHoldMs,
    note: "Report write + close card",
  },
] as const;
