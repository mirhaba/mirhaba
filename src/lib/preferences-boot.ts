// Shared by the server layout and the client preferences store (no "use client": the layout
// needs the real string, not a client reference).

export const PREFERENCES_KEY = "mirhaba.prefs";

/**
 * Runs before the first paint (inline in <head>): applies theme, text size and motion so a
 * dark-mode choice never flashes light. Kept tiny and dependency-free on purpose.
 */
export const PREFERENCES_BOOT_SCRIPT = `try{var p=JSON.parse(localStorage.getItem("${PREFERENCES_KEY}")||"{}"),r=document.documentElement;if(p.theme==="light"||p.theme==="dark")r.dataset.theme=p.theme;if(p.largeText===true)r.dataset.text="large";if(p.reduceMotion===true)r.dataset.motion="reduce"}catch(e){}`;
