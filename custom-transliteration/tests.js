// ㄹ is always romanized as "r"
// codas ㅎ, ㄶ and ㅀ are romanized as "H", "nH" and "rH" respectively, with capital H, since these ㅎ are never realized as "h".
// Vowel transcriptions are based on https://en.wikipedia.org/wiki/Romanization_of_Korean_(North_Korea) , except that ㅚ is romanized as "oe", not "oi".

console.assert(transliterate("붉은기") === "purk.ŭn.ki");
console.assert(transliterate("사회주의") === "sa.hoe.ju.ŭi");
console.assert(transliterate("지키세") === "ji.khi.se");
console.assert(transliterate("않는다") === "anH.nŭn.ta");
console.assert(transliterate("꽃을") === "kkoch.ŭr");
console.assert(transliterate("잃다") === "irH.ta");
console.assert(transliterate("핥다") === "harth.ta");

// standalone jamo
console.assert(transliterate("ㅂ") === "⟨p⟩");
console.assert(transliterate("ㅗ") === "⟨o⟩");
console.assert(transliterate("ㅏㅑㅓㅕ") === "⟨a⟩⟨ya⟩⟨ŏ⟩⟨yŏ⟩");
