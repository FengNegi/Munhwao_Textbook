// Transliteration — not transcription — of Hangul.
//
// Every syllable block is decomposed into onset / vowel / coda with the
// standard Unicode arithmetic, each of the three is looked up in a fixed
// table, and the pieces are glued back together.  There is deliberately no
// Korean phonology anywhere in here: 않는다 comes out as "anH.nŭn.ta", never
// "an.nŭn.da", and 꽃을 as "kkoch.ŭr", never "kko.chŭr".
//
// The letter values follow the North Korean romanization, with three
// deviations, all of them in the service of staying reversible:
//   * ㄹ is always "r", never "l";
//   * ㅚ is "oe", not "oi";
//   * a coda ㅎ is "H" (capital), because it is never realized as [h].

// 초성 (19), in Unicode order.  ㅇ carries no sound of its own here.
const ONSETS = [
  "k", // ㄱ
  "kk", // ㄲ
  "n", // ㄴ
  "t", // ㄷ
  "tt", // ㄸ
  "r", // ㄹ
  "m", // ㅁ
  "p", // ㅂ
  "pp", // ㅃ
  "s", // ㅅ
  "ss", // ㅆ
  "", // ㅇ
  "j", // ㅈ
  "jj", // ㅉ
  "ch", // ㅊ
  "kh", // ㅋ
  "th", // ㅌ
  "ph", // ㅍ
  "h", // ㅎ
];

// 중성 (21), in Unicode order.
const VOWELS = [
  "a", // ㅏ
  "ae", // ㅐ
  "ya", // ㅑ
  "yae", // ㅒ
  "ŏ", // ㅓ
  "e", // ㅔ
  "yŏ", // ㅕ
  "ye", // ㅖ
  "o", // ㅗ
  "wa", // ㅘ
  "wae", // ㅙ
  "oe", // ㅚ
  "yo", // ㅛ
  "u", // ㅜ
  "wŏ", // ㅝ
  "we", // ㅞ
  "wi", // ㅟ
  "yu", // ㅠ
  "ŭ", // ㅡ
  "ŭi", // ㅢ
  "i", // ㅣ
];

// 종성 (27 + "no coda"), in Unicode order.  A cluster is simply the two
// letters written one after the other (ㄺ = ㄹ + ㄱ = "rk").
const CODAS = [
  "", // (none)
  "k", // ㄱ
  "kk", // ㄲ
  "ks", // ㄳ
  "n", // ㄴ
  "nj", // ㄵ
  "nH", // ㄶ
  "t", // ㄷ
  "r", // ㄹ
  "rk", // ㄺ
  "rm", // ㄻ
  "rp", // ㄼ
  "rs", // ㄽ
  "rth", // ㄾ
  "rph", // ㄿ
  "rH", // ㅀ
  "m", // ㅁ
  "p", // ㅂ
  "ps", // ㅄ
  "s", // ㅅ
  "ss", // ㅆ
  "ng", // ㅇ
  "j", // ㅈ
  "ch", // ㅊ
  "kh", // ㅋ
  "th", // ㅌ
  "ph", // ㅍ
  "H", // ㅎ
];

const JAMO = {
  ㄱ: "k",
  ㄲ: "kk",
  ㄳ: "ks",
  ㄴ: "n",
  ㄵ: "nj",
  ㄶ: "nH",
  ㄷ: "t",
  ㄸ: "tt",
  ㄹ: "r",
  ㄺ: "rk",
  ㄻ: "rm",
  ㄼ: "rp",
  ㄽ: "rs",
  ㄾ: "rth",
  ㄿ: "rph",
  ㅀ: "rH",
  ㅁ: "m",
  ㅂ: "p",
  ㅃ: "pp",
  ㅄ: "ps",
  ㅅ: "s",
  ㅆ: "ss",
  ㅇ: "∅|ng",
  ㅈ: "j",
  ㅉ: "jj",
  ㅊ: "ch",
  ㅋ: "kh",
  ㅌ: "th",
  ㅍ: "ph",
  ㅎ: "h",
};

// The compatibility jamo vowels (U+314F ㅏ … U+3163 ㅣ) run in the same order
// as the syllable medials, so they can borrow that table wholesale.
const COMPATIBILITY_VOWEL_BASE = 0x314f;
VOWELS.forEach((vowel, i) => {
  JAMO[String.fromCodePoint(COMPATIBILITY_VOWEL_BASE + i)] = vowel;
});

// Unicode's Hangul Syllables block: S = 0xAC00 + (onset × 588) + (vowel × 28) + coda
const SYLLABLE_BASE = 0xac00;
const CODA_COUNT = CODAS.length; // 28
const VOWEL_COUNT = VOWELS.length; // 21
const SYLLABLE_COUNT = ONSETS.length * VOWEL_COUNT * CODA_COUNT; // 11172

// Returns the romanization of one precomposed syllable block, or null for
// anything else (Latin letters, punctuation, lone jamo, spaces …).
function romanizeSyllable(character) {
  const index = character.codePointAt(0) - SYLLABLE_BASE;
  if (index < 0 || index >= SYLLABLE_COUNT) return null;
  const onset = Math.floor(index / (VOWEL_COUNT * CODA_COUNT));
  const vowel = Math.floor((index % (VOWEL_COUNT * CODA_COUNT)) / CODA_COUNT);
  const coda = index % CODA_COUNT;
  return ONSETS[onset] + VOWELS[vowel] + CODAS[coda];
}

// Transliterates every Hangul syllable in `text`, joining syllables that were
// written together with ".", and writes any lone jamo as ⟨…⟩.  Everything else
// is passed through untouched, and ends a run of syllables: "기'발" -> "ki'par".
export function transliterate(text) {
  let out = "";
  let inSyllableRun = false;
  for (const character of text.normalize("NFC")) {
    const roman = romanizeSyllable(character);
    if (roman !== null) {
      out += inSyllableRun ? `.${roman}` : roman;
      inSyllableRun = true;
      continue;
    }
    const jamo = JAMO[character];
    out += jamo === undefined ? character : `⟨${jamo}⟩`;
    inSyllableRun = false;
  }
  return out;
}

export default transliterate;
