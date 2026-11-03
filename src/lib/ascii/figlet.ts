/**
 * Pre-rendered figlet ASCII (fonts from xero/figlet-fonts examples).
 * Wordmark: Slant · Section titles: Small
 * Keep crisp via monospace + pre; do not scale with CSS transform.
 */

export const FIGLET_BENCHMATE = `
    ____                  __    __  ___      __
   / __ )___  ____  _____/ /_  /  |/  /___ _/ /____
  / __  / _ \\/ __ \\/ ___/ __ \\/ /|_/ / __ \`/ __/ _ \\
 / /_/ /  __/ / / / /__/ / / / /  / / /_/ / /_/  __/
/_____/\\___/_/ /_/\\___/_/ /_/_/  /_/\\__,_/\\__/\\___/
`.trimEnd();

/** Compact wordmark for tight header chrome */
export const FIGLET_BENCHMATE_SM = `
 ____                  _     __  __       _
| __ )  ___ _ __   ___| |__ |  \\/  | __ _| |_ ___
|  _ \\ / _ \\ '_ \\ / __| '_ \\| |\\/| |/ _\` | __/ _ \\
| |_) |  __/ | | | (__| | | | |  | | (_| | ||  __/
|____/ \\___|_| |_|\\___|_| |_|_|  |_|\\__,_|\\__\\___|
`.trimEnd();

export const FIGLET_SECTIONS = {
  photos: `
 ___ _  _  ___ _____ ___  ___
| _ \\ || |/ _ \\_   _/ _ \\/ __|
|  _/ __ | (_) || || (_) \\__ \\
|_| |_||_|\\___/ |_| \\___/|___/
`.trimEnd(),
  vision: `
__   _____ ___ ___ ___  _  _
\\ \\ / /_ _/ __|_ _/ _ \\| \\| |
 \\ V / | |\\__ \\| | (_) | .\` |
  \\_/ |___|___/___\\___/|_|\\_|
`.trimEnd(),
  agent: `
   _   ___ ___ _  _ _____
  /_\\ / __| __| \\| |_   _|
 / _ \\ (_ | _|| .\` | | |
/_/ \\_\\___|___|_|\\_| |_|
`.trimEnd(),
  verify: `
__   _____ ___ ___ ___ __  __
\\ \\ / / __| _ \\_ _| __\\ \\/ /
 \\ V /| _||   /| || _| >  <
  \\_/ |___|_|_\\___|___/_/\\_\\
`.trimEnd(),
  report: `
 ___ ___ ___  ___  ___ _____
| _ \\ __| _ \\/ _ \\| _ \\_   _|
|   / _||  _/ (_) |   / | |
|_|_\\___|_|  \\___/|_|_\\ |_|
`.trimEnd(),
} as const;

export type FigletSection = keyof typeof FIGLET_SECTIONS;
