// text-utils.js — text processing utilities for the brain server

import crypto from "crypto";

// Stopwords for conflict detection and similarity matching
export const STOPWORDS = new Set([
  "the","a","an","is","are","was","were","be","been","being","have","has","had",
  "do","does","did","will","would","shall","should","may","might","must","can",
  "could","and","but","or","nor","for","yet","so","in","on","at","to","from",
  "by","with","of","as","if","not","no","all","any","each","every","this","that",
  "these","those","it","its","i","we","you","he","she","they","me","us","him",
  "her","them","my","our","your","his","their","what","which","who","whom","when",
  "where","why","how","use","using","used","via","into","also","just","only",
  "than","then","very","too","more"
]);

export const tokenize = (text) => {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 1 && !STOPWORDS.has(w));
};

// Similarity: shared tokens / sqrt(setA.size * setB.size)
export const similarity = (tokensA, tokensB) => {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let shared = 0;
  for (const t of setA) {
    if (setB.has(t)) shared++;
  }
  return shared / Math.sqrt(setA.size * setB.size);
};

// Bigram tokenization for improved similarity matching
export const bigramTokenize = (text) => {
  const words = tokenize(text);
  if (words.length < 2) return words;
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]}_${words[i + 1]}`);
  }
  return bigrams;
};

const COMMON_PREFIXES = /^(always|never|use|don't|do not|ensure|make sure|remember to|avoid|prefer|when|if|for)\s+/i;

export const semanticNormalize = (text) => {
  return text.replace(COMMON_PREFIXES, "").trim();
};

export const combinedSimilarity = (textA, textB) => {
  const normA = semanticNormalize(textA);
  const normB = semanticNormalize(textB);
  const uniA = tokenize(normA);
  const uniB = tokenize(normB);
  const biA = bigramTokenize(normA);
  const biB = bigramTokenize(normB);
  const uniSim = similarity(uniA, uniB);
  const biSim = biA.length > 0 && biB.length > 0 ? similarity(biA, biB) : uniSim;
  return 0.6 * uniSim + 0.4 * biSim;
};

// Slugify a name into a URL/CLI-friendly ID with collision handling
export const slugify = (text, prefix, existingIds) => {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")   // strip non-alphanumeric
    .replace(/\s+/g, "-")            // spaces to hyphens
    .replace(/-+/g, "-")             // collapse multiple hyphens
    .replace(/^-|-$/g, "")           // trim leading/trailing hyphens
    .slice(0, 50);                   // cap length
  const slug = `${prefix}-${base || crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
  if (!existingIds || !existingIds.has(slug)) return slug;
  // Collision: append -2, -3, etc.
  let n = 2;
  while (existingIds.has(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
};
