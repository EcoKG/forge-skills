#!/usr/bin/env node
/**
 * Batch Calibrator — Offline CLI tool for adaptive weight calibration.
 *
 * Analyzes feedback-log.jsonl to compute TP/FP/FN/TN statistics,
 * identifies over-triggering keywords (FP reduction) and missing
 * keyword candidates (FN recovery), and generates adaptive-weights.json.
 *
 * Usage:
 *   node batch-calibrator.js --feedback <path> [--weights <path>] [--corpus <path>]
 *
 * Options:
 *   --feedback  Path to feedback-log.jsonl (required)
 *   --weights   Output path for adaptive-weights.json (default: same dir as feedback)
 *   --corpus    Path to scoring-corpus.json for appending FN entries
 *   --help      Show usage information
 *
 * No external dependencies. Fail-open design.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// Default scoring weights from skill-rules.json
const DEFAULT_WEIGHTS = {
  keyword: 15,
  lowKeyword: 8,
  intent: 20,
  fileExtension: 50,
  actionVerb: 30,
  codeIdentifier: 20,
  negativeSignal: -40,
};

// Default thresholds for graduated confidence
const DEFAULT_THRESHOLDS = {
  block: 80,
  ask: 50,
  pass: 0,
};

const MAX_ENTRIES = 500;
const TOP_N_KEYWORDS = 10;

/**
 * Parse JSONL file and return array of parsed entries.
 * @param {string} filePath
 * @param {number} [maxEntries=500]
 * @returns {object[]}
 */
function readJsonl(filePath, maxEntries = MAX_ENTRIES) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    // Take last N entries (most recent)
    const recent = lines.slice(-maxEntries);
    const entries = [];
    for (const line of recent) {
      try {
        entries.push(JSON.parse(line));
      } catch {
        // Skip malformed lines
      }
    }
    return entries;
  } catch {
    return [];
  }
}

/**
 * Extract keywords from a prompt string.
 * Simple word tokenization with normalization.
 * @param {string} prompt
 * @returns {string[]}
 */
function extractKeywords(prompt) {
  if (!prompt) return [];
  return prompt
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2);
}

/**
 * Analyze FP cases to find over-triggering keywords.
 * Returns top N keywords sorted by frequency in FP prompts.
 * @param {object[]} fpEntries
 * @returns {{ keyword: string, count: number, suggestedWeightDelta: number }[]}
 */
function analyzeFPKeywords(fpEntries) {
  const keywordCounts = {};

  for (const entry of fpEntries) {
    const keywords = extractKeywords(entry.prompt);
    const seen = new Set();
    for (const kw of keywords) {
      if (!seen.has(kw)) {
        seen.add(kw);
        keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
      }
    }
  }

  return Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N_KEYWORDS)
    .map(([keyword, count]) => ({
      keyword,
      count,
      suggestedWeightDelta: -2,
    }));
}

/**
 * Analyze FN cases to find missing keyword candidates.
 * Extracts keywords from prompts that should have triggered but didn't.
 * @param {object[]} fnEntries
 * @returns {{ keyword: string, count: number }[]}
 */
function analyzeFNKeywords(fnEntries) {
  const keywordCounts = {};

  for (const entry of fnEntries) {
    const keywords = extractKeywords(entry.prompt);
    const seen = new Set();
    for (const kw of keywords) {
      if (!seen.has(kw)) {
        seen.add(kw);
        keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
      }
    }
  }

  return Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N_KEYWORDS)
    .map(([keyword, count]) => ({ keyword, count }));
}

/**
 * Run the calibration pipeline.
 *
 * @param {string} feedbackPath — path to feedback-log.jsonl
 * @param {string} weightsPath — output path for adaptive-weights.json
 * @param {string} [corpusPath] — optional path to scoring-corpus.json for FN entry append
 * @returns {{ summary: object, weightsWritten: boolean, corpusEntriesAdded: number }}
 */
export async function calibrate(feedbackPath, weightsPath, corpusPath) {
  // 1. Load feedback entries
  const entries = readJsonl(feedbackPath, MAX_ENTRIES);
  if (entries.length === 0) {
    const msg = 'No feedback entries found.';
    console.log(msg);
    return { summary: { total: 0, message: msg }, weightsWritten: false, corpusEntriesAdded: 0 };
  }

  // 2. Classify counts
  const counts = { TP: 0, FP: 0, FN: 0, TN: 0 };
  const fpEntries = [];
  const fnEntries = [];

  for (const entry of entries) {
    const verdict = entry.verdict || classifyEntry(entry);
    counts[verdict] = (counts[verdict] || 0) + 1;
    if (verdict === 'FP') fpEntries.push(entry);
    if (verdict === 'FN') fnEntries.push(entry);
  }

  // 3. Analyze FP: which keywords over-triggered
  const fpKeywords = analyzeFPKeywords(fpEntries);

  // 4. Analyze FN: missing keyword candidates
  const fnKeywords = analyzeFNKeywords(fnEntries);

  // 5. Calculate adjusted weights
  const adjustedWeights = { ...DEFAULT_WEIGHTS };

  // Apply FP-driven weight reductions
  const keywordAdjustments = {};
  for (const { keyword, suggestedWeightDelta } of fpKeywords) {
    keywordAdjustments[keyword] = suggestedWeightDelta;
  }

  // Calculate precision and recall for threshold tuning
  const precision = counts.TP + counts.FP > 0
    ? counts.TP / (counts.TP + counts.FP)
    : 1;
  const recall = counts.TP + counts.FN > 0
    ? counts.TP / (counts.TP + counts.FN)
    : 1;

  // Adjust thresholds based on precision/recall balance
  const thresholds = { ...DEFAULT_THRESHOLDS };
  if (precision < 0.7) {
    // Too many false positives — raise block threshold
    thresholds.block = Math.min(95, thresholds.block + 5);
  }
  if (recall < 0.7) {
    // Too many false negatives — lower ask threshold
    thresholds.ask = Math.max(30, thresholds.ask - 5);
  }

  // 6. Generate new corpus entries from FN cases
  const newCorpusEntries = fnEntries
    .filter(e => e.prompt && e.prompt.length >= 5)
    .map(e => ({
      prompt: e.prompt,
      shouldTrigger: true,
      category: 'code-request',
      lang: detectLang(e.prompt),
      source: 'feedback-FN',
    }));

  // Deduplicate corpus entries by prompt
  const uniqueCorpusEntries = [];
  const seenPrompts = new Set();
  for (const entry of newCorpusEntries) {
    const normalized = entry.prompt.toLowerCase().trim();
    if (!seenPrompts.has(normalized)) {
      seenPrompts.add(normalized);
      uniqueCorpusEntries.push(entry);
    }
  }

  // 7. Write adaptive-weights.json
  let weightsWritten = false;
  try {
    const weightsData = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      sampleSize: entries.length,
      counts,
      precision: Math.round(precision * 1000) / 1000,
      recall: Math.round(recall * 1000) / 1000,
      weights: adjustedWeights,
      keywordAdjustments,
      thresholds,
      fpTopKeywords: fpKeywords,
      fnTopKeywords: fnKeywords,
      newCorpusEntries: uniqueCorpusEntries.length,
    };

    const weightsDir = path.dirname(weightsPath);
    if (!fs.existsSync(weightsDir)) {
      fs.mkdirSync(weightsDir, { recursive: true });
    }

    const tmpPath = weightsPath + `.tmp.${process.pid}`;
    fs.writeFileSync(tmpPath, JSON.stringify(weightsData, null, 2));
    fs.renameSync(tmpPath, weightsPath);
    weightsWritten = true;
  } catch (err) {
    console.error('Failed to write adaptive-weights.json:', err.message);
  }

  // 8. Append new corpus entries to scoring-corpus.json
  let corpusEntriesAdded = 0;
  if (corpusPath && uniqueCorpusEntries.length > 0) {
    try {
      let corpus = [];
      if (fs.existsSync(corpusPath)) {
        corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf-8'));
      }

      // Deduplicate against existing corpus
      const existingPrompts = new Set(corpus.map(e => e.prompt.toLowerCase().trim()));
      const toAdd = uniqueCorpusEntries.filter(e =>
        !existingPrompts.has(e.prompt.toLowerCase().trim())
      );

      if (toAdd.length > 0) {
        corpus.push(...toAdd);
        const tmpPath = corpusPath + `.tmp.${process.pid}`;
        fs.writeFileSync(tmpPath, JSON.stringify(corpus, null, 2));
        fs.renameSync(tmpPath, corpusPath);
        corpusEntriesAdded = toAdd.length;
      }
    } catch (err) {
      console.error('Failed to update corpus:', err.message);
    }
  }

  // 9. Report summary
  const summary = {
    total: entries.length,
    counts,
    precision: Math.round(precision * 1000) / 1000,
    recall: Math.round(recall * 1000) / 1000,
    fpTopKeywords: fpKeywords.map(k => `${k.keyword} (${k.count})`),
    fnTopKeywords: fnKeywords.map(k => `${k.keyword} (${k.count})`),
    thresholds,
    weightsWritten,
    corpusEntriesAdded,
  };

  console.log('\n=== Batch Calibration Report ===\n');
  console.log(`Sample size: ${entries.length}`);
  console.log(`TP: ${counts.TP}  FP: ${counts.FP}  FN: ${counts.FN}  TN: ${counts.TN}`);
  console.log(`Precision: ${summary.precision}  Recall: ${summary.recall}`);
  console.log(`\nFP top keywords: ${summary.fpTopKeywords.join(', ') || '(none)'}`);
  console.log(`FN top keywords: ${summary.fnTopKeywords.join(', ') || '(none)'}`);
  console.log(`\nThresholds: block=${thresholds.block}, ask=${thresholds.ask}, pass=${thresholds.pass}`);
  console.log(`Weights written: ${weightsWritten}`);
  console.log(`Corpus entries added: ${corpusEntriesAdded}`);

  return { summary, weightsWritten, corpusEntriesAdded };
}

/**
 * Classify an entry based on triggered/userInvokedSkill fields.
 * Fallback for entries without pre-computed verdict.
 * @param {object} entry
 * @returns {'TP'|'FP'|'FN'|'TN'}
 */
function classifyEntry(entry) {
  const triggered = Boolean(entry.triggered);
  const invoked = Boolean(entry.userInvokedSkill);
  if (triggered && invoked) return 'TP';
  if (triggered && !invoked) return 'FP';
  if (!triggered && invoked) return 'FN';
  return 'TN';
}

/**
 * Simple language detection based on character analysis.
 * @param {string} text
 * @returns {'ko'|'en'|'mixed'}
 */
function detectLang(text) {
  if (!text) return 'en';
  const koreanChars = (text.match(/[\uAC00-\uD7AF\u3130-\u318F]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  if (koreanChars > 0 && latinChars > 0) return 'mixed';
  if (koreanChars > 0) return 'ko';
  return 'en';
}

/**
 * Print usage information.
 */
function printUsage() {
  console.log('Usage: node batch-calibrator.js --feedback <path> [--weights <path>] [--corpus <path>]');
  console.log('');
  console.log('Options:');
  console.log('  --feedback  Path to feedback-log.jsonl (required)');
  console.log('  --weights   Output path for adaptive-weights.json');
  console.log('              (default: <feedback-dir>/adaptive-weights.json)');
  console.log('  --corpus    Path to scoring-corpus.json for appending FN entries');
  console.log('  --help      Show this help message');
}

/**
 * Parse CLI arguments.
 * @param {string[]} args
 * @returns {{ feedback: string, weights: string, corpus: string|null, help: boolean }}
 */
function parseArgs(args) {
  const result = { feedback: '', weights: '', corpus: null, help: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--feedback':
        result.feedback = args[++i] || '';
        break;
      case '--weights':
        result.weights = args[++i] || '';
        break;
      case '--corpus':
        result.corpus = args[++i] || '';
        break;
      case '--help':
      case '-h':
        result.help = true;
        break;
    }
  }

  return result;
}

// CLI entry point
const isMain = process.argv[1] && (
  process.argv[1].endsWith('batch-calibrator.js') ||
  process.argv[1].endsWith('batch-calibrator')
);

if (isMain) {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (!args.feedback) {
    console.error('Error: --feedback <path> is required.');
    printUsage();
    process.exit(1);
  }

  const feedbackPath = path.resolve(args.feedback);
  const weightsPath = args.weights
    ? path.resolve(args.weights)
    : path.join(path.dirname(feedbackPath), 'adaptive-weights.json');
  const corpusPath = args.corpus ? path.resolve(args.corpus) : null;

  calibrate(feedbackPath, weightsPath, corpusPath)
    .then(result => {
      if (!result.weightsWritten) {
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Calibration failed:', err.message);
      process.exit(1);
    });
}
