import type { Lang } from "./i18n";
import type { Phase } from "./game";

const NARRATOR_STORAGE_KEY = "mafia_narrator_muted";

export function isNarratorMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(NARRATOR_STORAGE_KEY) === "true";
}

export function setNarratorMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NARRATOR_STORAGE_KEY, muted ? "true" : "false");
  if (muted) stopNarrator();
}

const PHRASE_MAP: Record<
  Lang,
  Partial<Record<Phase | "GAME_START" | "WOLVES_WIN" | "TOWN_WIN", string>>
> = {
  ar: {
    ROLE_DISTRIBUTION: "حلّ الليل على القرية، والجميع نيام... وُزعت الأدوار سراً.",
    NIGHT_WOLVES: "استيقظت جماعة الذئاب لاختيار ضحيتها في جنح الظلام...",
    NIGHT_DETECTIVE: "استيقظ المحقق لتقصي الحقائق وكشف الهويات...",
    NIGHT_DOCTOR: "استيقظ الطبيب ليقرر من ينقذه الليلة...",
    NIGHT_RESULT: "أشرقت شمس يوم جديد... استيقظوا جميعاً لتروا ما حدث!",
    DAY_DISCUSSION: "حان وقت النقاش وتقديم الأدلة، لكل لاعب دقيقة للتحدث.",
    DAY_CONCLUSION: "النقاش العام مفتوح، استعدوا للحسم.",
    DAY_VOTING: "بدأ التصويت النهائي! صوّتوا بحذر.",
    GAME_START: "بدأت اللعبة. ليلة المافيا تنطلق الآن.",
    WOLVES_WIN: "انتهت اللعبة! الذئاب أحكمت سيطرتها على القرية.",
    TOWN_WIN: "انتهت اللعبة! انتصرت القرية وتخلصت من الأشرار.",
  },
  en: {
    ROLE_DISTRIBUTION: "Night falls upon the village, everyone goes to sleep... Roles are dealt.",
    NIGHT_WOLVES: "Wolves awaken, choose your victim in silence...",
    NIGHT_DETECTIVE: "Detective awakens, investigate a suspect...",
    NIGHT_DOCTOR: "Doctor awakens, choose who to protect tonight...",
    NIGHT_RESULT: "The sun rises, village wake up and see the aftermath!",
    DAY_DISCUSSION: "Discussion begins: each living player has their turn to speak.",
    DAY_CONCLUSION: "Open floor debate. Prepare for the final vote.",
    DAY_VOTING: "Voting is now open. Choose wisely.",
    GAME_START: "The game begins. Trust no one.",
    WOLVES_WIN: "Game over! The wolves have dominated the village.",
    TOWN_WIN: "Game over! The town has prevailed and found peace.",
  },
  fr: {
    ROLE_DISTRIBUTION:
      "La nuit tombe sur le village, tout le monde s'endort... Les rôles sont distribués.",
    NIGHT_WOLVES: "Les loups se réveillent pour désigner leur proie dans l'ombre...",
    NIGHT_DETECTIVE: "Le détective se réveille pour mener son enquête...",
    NIGHT_DOCTOR: "Le médecin se réveille pour administrer ses soins...",
    NIGHT_RESULT: "Le soleil se lève, le village se réveille !",
    DAY_DISCUSSION: "Les débats commencent, chaque joueur a la parole.",
    DAY_CONCLUSION: "Discussion libre. Préparez-vous à voter.",
    DAY_VOTING: "Le vote est ouvert. Faites votre choix.",
    GAME_START: "La partie commence. Ne faites confiance à personne.",
    WOLVES_WIN: "Partie terminée ! Les loups triomphent.",
    TOWN_WIN: "Partie terminée ! Le village l'emporte.",
  },
};

let lastSpokenPhase: string | null = null;

export function speakPhase(phase: Phase | "GAME_START" | "WOLVES_WIN" | "TOWN_WIN", lang: Lang) {
  if (typeof window === "undefined") return;
  if (isNarratorMuted()) return;

  const key = `${phase}_${lang}`;
  if (lastSpokenPhase === key) return;
  lastSpokenPhase = key;

  const text = PHRASE_MAP[lang]?.[phase] || PHRASE_MAP.en[phase];
  if (!text) return;

  void playEleven(text).catch(() => speakBrowser(text, lang));
}

let current: HTMLAudioElement | null = null;
const cache = new Map<string, string>();

async function playEleven(text: string) {
  let url = cache.get(text);
  if (!url) {
    const res = await fetch("/api/narrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`narrate ${res.status}`);
    url = URL.createObjectURL(await res.blob());
    cache.set(text, url);
  }
  if (isNarratorMuted()) return;
  current?.pause();
  current = new Audio(url);
  await current.play();
}

export function stopNarrator() {
  current?.pause();
  current = null;
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

function speakBrowser(text: string, lang: Lang) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95; // Slightly dramatic, clear pacing
  utterance.pitch = 0.9; // Deeper narrator tone

  // Select suitable voice for language
  const voices = window.speechSynthesis.getVoices();
  const langPrefix = lang === "ar" ? "ar" : lang === "fr" ? "fr" : "en";
  const matchedVoice = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }
  utterance.lang = lang === "ar" ? "ar-SA" : lang === "fr" ? "fr-FR" : "en-US";

  window.speechSynthesis.speak(utterance);
}
