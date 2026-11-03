/** Lightweight preformatted ASCII frame loops — biology-themed, monochrome. */

export type AsciiClipId = "amoeba" | "mitosis" | "colonies" | "pipette";

export type AsciiClip = {
  id: AsciiClipId;
  label: string;
  /** ms between frames */
  intervalMs: number;
  frames: string[];
};

/** Amoeba crawling / pseudopod extension */
export const AMOEBA: AsciiClip = {
  id: "amoeba",
  label: "amoeba",
  intervalMs: 180,
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
   /  .(o) .  \\
   \\     .    /
    '-.____.-'
`,
    `
        .--.
     .-'    '-.
    / .(o).    \\____
    \\    .     /
     '-.____.-'
`,
    `
         .--.
      .-'    '-.____
     / .(o).        \\
     \\    .    ____/
      '-.____.-'
`,
    `
          .--.
       .-'    '-.__
      / .(o)  .     \\
      \\         ____/
       '-.____.-'
`,
    `
        .--.
     .-'    '-.
    / .(o).    \\
    \\    .   ./
     '-.____.-'
`,
  ],
};

/** Cell undergoing mitosis */
export const MITOSIS: AsciiClip = {
  id: "mitosis",
  label: "mitosis",
  intervalMs: 220,
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
     /  · ··  \\
    | · X  X · |
     \\  ·· ·  /
      '------'
`,
    `
     .---.  .---.
    / ·X· \\/ ·X· \\
   |  ···  ||  ···  |
    \\     /\\     /
     '---'  '---'
`,
    `
    .---.      .---.
   / ·X· \\    / ·X· \\
  |  ···  |  |  ···  |
   \\     /    \\     /
    '---'      '---'
`,
    `
   .---.        .---.
  / ··· \\      / ··· \\
 | · X · |    | · X · |
  \\ ··· /      \\ ··· /
   '---'        '---'
`,
    `
    .---.      .---.
   / ··· \\    / ··· \\
  | · X · |  | · X · |
   \\ ··· /    \\ ··· /
    '---'      '---'
`,
  ],
};

/** Bacterial colonies blooming on a petri dish */
export const COLONIES: AsciiClip = {
  id: "colonies",
  label: "colonies",
  intervalMs: 200,
  frames: [
    `
      ___________
     /           \\
    |      ·      |
    |             |
     \\___________/
`,
    `
      ___________
     /           \\
    |   ·   ·     |
    |      ·      |
     \\___________/
`,
    `
      ___________
     /  ·        \\
    |   ··  ·     |
    |  ·   ··     |
     \\___________/
`,
    `
      ___________
     / ··   ··   \\
    |  ···  ·· ·  |
    | · ···  ··   |
     \\___________/
`,
    `
      ___________
     /·· ··· ··  \\
    | ····· ····  |
    |·· ····· ··  |
     \\___________/
`,
    `
      ___________
     /···••••··· \\
    |•••• ···•··· |
    |··•····•···• |
     \\___________/
`,
  ],
};

/** Optional pipette drip */
export const PIPETTE: AsciiClip = {
  id: "pipette",
  label: "pipette",
  intervalMs: 160,
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
       
       
`,
  ],
};

export const ASCII_CLIPS: Record<AsciiClipId, AsciiClip> = {
  amoeba: AMOEBA,
  mitosis: MITOSIS,
  colonies: COLONIES,
  pipette: PIPETTE,
};

/** Map pipeline / loading context → clip */
export function clipForContext(
  context: "idle" | "extract" | "compute" | "verify" | "report" | "rotate",
  tick = 0,
): AsciiClipId {
  switch (context) {
    case "extract":
      return "colonies";
    case "compute":
      return "amoeba";
    case "verify":
      return "mitosis";
    case "report":
      return "pipette";
    case "rotate":
      return (["amoeba", "mitosis", "colonies", "pipette"] as AsciiClipId[])[tick % 4];
    default:
      return "colonies";
  }
}
