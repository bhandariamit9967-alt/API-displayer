import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import Groq from "groq-sdk";

interface DebateRound {
  roundNumber: number;
  userArgument: string;
  aiRebuttal: string;
  score: RoundScore;
  timestamp: number;
}

interface RoundScore {
  clarity: number;
  evidence: number;
  logic: number;
  overall: number;
  feedback: string;
}

interface DebateSession {
  id: string;
  topic: string;
  userPosition: "for" | "against";
  difficulty: "easy" | "medium" | "hard" | "expert";
  rounds: DebateRound[];
  startedAt: number;
  endedAt?: number;
  finalVerdict?: string;
}

interface HistoryFile {
  sessions: DebateSession[];
}

export function activate(context: vscode.ExtensionContext) {
  const storageDir = context.globalStorageUri.fsPath;
  const historyFilePath = path.join(storageDir, "debate-history.json");

  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const getGroqClient = (): Groq => {
    const config = vscode.workspace.getConfiguration("debatePartner");
    const apiKey: string =
      config.get<string>("groqApiKey") ||
      process.env.GROQ_API_KEY ||
      "";

    if (!apiKey) {
      throw new Error(
        "No Groq API key found. Set it in Settings → Debate Partner → Groq Api Key, " +
          "or export the GROQ_API_KEY environment variable."
      );
    }
    return new Groq({ apiKey });
  };

  let panel: vscode.WebviewPanel | undefined;

  const openCommand = vscode.commands.registerCommand(
    "debatePartner.open",
    () => {
      if (panel) {
        panel.reveal(vscode.ViewColumn.Beside);
        return;
      }

      panel = vscode.window.createWebviewPanel(
        "debatePartner",
        "Debate Partner",
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [],
        }
      );

      panel.webview.html = getWebviewContent();

      const history = loadHistory(historyFilePath);
      panel.webview.postMessage({ type: "history", sessions: history.sessions });

      panel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.type) {
            case "startDebate": {
              const { topic, userPosition, difficulty } = message;
              const sessionId = `session-${Date.now()}`;

              const hist = loadHistory(historyFilePath);
              const newSession: DebateSession = {
                id: sessionId,
                topic,
                userPosition,
                difficulty,
                rounds: [],
                startedAt: Date.now(),
              };
              hist.sessions.unshift(newSession);
              saveHistory(historyFilePath, hist);

              panel?.webview.postMessage({
                type: "debateStarted",
                sessionId,
                topic,
                userPosition,
                difficulty,
              });

              try {
                const client = getGroqClient();
                const opening = await generateOpeningStatement(
                  client,
                  topic,
                  userPosition,
                  difficulty
                );
                panel?.webview.postMessage({
                  type: "aiOpening",
                  sessionId,
                  text: opening,
                });
              } catch (err: unknown) {
                panel?.webview.postMessage({
                  type: "error",
                  message: errorMessage(err),
                });
              }
              break;
            }

            case "submitArgument": {
              const { sessionId, roundNumber, userArgument, topic, userPosition, difficulty } =
                message;

              try {
                const client = getGroqClient();

                const [score, rebuttal] = await Promise.all([
                  scoreArgument(client, userArgument, topic, difficulty),
                  generateRebuttal(
                    client,
                    userArgument,
                    topic,
                    userPosition,
                    difficulty,
                    roundNumber
                  ),
                ]);

                const round: DebateRound = {
                  roundNumber,
                  userArgument,
                  aiRebuttal: rebuttal,
                  score,
                  timestamp: Date.now(),
                };

                const hist = loadHistory(historyFilePath);
                const session = hist.sessions.find((s) => s.id === sessionId);
                if (session) {
                  session.rounds.push(round);
                  saveHistory(historyFilePath, hist);
                }

                panel?.webview.postMessage({
                  type: "roundResult",
                  sessionId,
                  round,
                });
              } catch (err: unknown) {
                panel?.webview.postMessage({
                  type: "error",
                  message: errorMessage(err),
                });
              }
              break;
            }

            case "endDebate": {
              const { sessionId, topic, userPosition, difficulty, rounds } = message;

              try {
                const client = getGroqClient();
                const verdict = await generateVerdict(
                  client,
                  topic,
                  userPosition,
                  difficulty,
                  rounds
                );

                const hist = loadHistory(historyFilePath);
                const session = hist.sessions.find((s) => s.id === sessionId);
                if (session) {
                  session.endedAt = Date.now();
                  session.finalVerdict = verdict;
                  saveHistory(historyFilePath, hist);
                }

                panel?.webview.postMessage({
                  type: "debateEnded",
                  sessionId,
                  verdict,
                });
              } catch (err: unknown) {
                panel?.webview.postMessage({
                  type: "error",
                  message: errorMessage(err),
                });
              }
              break;
            }

            case "loadHistory": {
              const hist = loadHistory(historyFilePath);
              panel?.webview.postMessage({
                type: "history",
                sessions: hist.sessions,
              });
              break;
            }

            case "deleteSession": {
              const { sessionId } = message;
              const hist = loadHistory(historyFilePath);
              hist.sessions = hist.sessions.filter((s) => s.id !== sessionId);
              saveHistory(historyFilePath, hist);
              panel?.webview.postMessage({
                type: "history",
                sessions: hist.sessions,
              });
              break;
            }
          }
        },
        undefined,
        context.subscriptions
      );

      panel.onDidDispose(
        () => {
          panel = undefined;
        },
        undefined,
        context.subscriptions
      );
    }
  );

  context.subscriptions.push(openCommand);
}

export function deactivate() {}

const DIFFICULTY_INSTRUCTIONS: Record<string, string> = {
  easy: "Keep your arguments straightforward and supportive. Avoid jargon. This is a beginner-level practice.",
  medium:
    "Make well-rounded arguments with clear reasoning. Introduce some nuance and a couple of real-world examples.",
  hard: "Deploy sharp, evidence-backed counter-arguments. Use rhetorical techniques, anticipate the user's next move, and challenge every weak point.",
  expert:
    "Argue like a world-class debate champion. Use rigorous logic, cite studies or historical precedent, expose every logical fallacy, and deliver the most devastating possible rebuttal.",
};

async function generateOpeningStatement(
  client: Groq,
  topic: string,
  userPosition: "for" | "against",
  difficulty: string
): Promise<string> {
  const aiPosition = userPosition === "for" ? "against" : "for";
  const prompt = `You are an elite debate coach running a debate practice session.

Topic: "${topic}"
You are arguing: ${aiPosition.toUpperCase()} the topic.
The human is arguing: ${userPosition.toUpperCase()}.
Difficulty: ${difficulty.toUpperCase()} — ${DIFFICULTY_INSTRUCTIONS[difficulty]}

Deliver a compelling 3-4 sentence OPENING STATEMENT that stakes out your position clearly. 
Do NOT repeat the topic verbatim. Be direct and punchy.`;

  const result = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });
  return result.choices[0]?.message?.content ?? "";
}

async function generateRebuttal(
  client: Groq,
  userArgument: string,
  topic: string,
  userPosition: "for" | "against",
  difficulty: string,
  roundNumber: number
): Promise<string> {
  const aiPosition = userPosition === "for" ? "against" : "for";
  const prompt = `You are debating the topic: "${topic}"
You are arguing: ${aiPosition.toUpperCase()}.
Round: ${roundNumber}
Difficulty: ${difficulty.toUpperCase()} — ${DIFFICULTY_INSTRUCTIONS[difficulty]}

The human just argued:
"${userArgument}"

Write a sharp, focused 3-5 sentence REBUTTAL. Directly address their points, expose weaknesses, and advance your own argument. Stay in character as a passionate debater.`;

  const result = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });
  return result.choices[0]?.message?.content ?? "";
}

async function scoreArgument(
  client: Groq,
  userArgument: string,
  topic: string,
  difficulty: string
): Promise<RoundScore> {
  const prompt = `You are an impartial debate judge. Score the following argument on the topic "${topic}".

Argument:
"${userArgument}"

Difficulty context: ${difficulty}

Return ONLY a raw JSON object (no markdown, no code fences) with exactly these keys:
{
  "clarity": <integer 1-10>,
  "evidence": <integer 1-10>,
  "logic": <integer 1-10>,
  "feedback": "<one concise sentence of constructive feedback>"
}

Be honest. If the argument is weak, score it low. If it's strong, score it high.`;

  const result = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const raw = (result.choices[0]?.message?.content ?? "").trim();
    const cleaned = raw.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const clarity = clamp(parsed.clarity, 1, 10);
    const evidence = clamp(parsed.evidence, 1, 10);
    const logic = clamp(parsed.logic, 1, 10);
    return {
      clarity,
      evidence,
      logic,
      overall: Math.round(((clarity + evidence + logic) / 3) * 10) / 10,
      feedback: parsed.feedback || "Good effort.",
    };
  } catch {
    return { clarity: 5, evidence: 5, logic: 5, overall: 5, feedback: "Keep it up!" };
  }
}

async function generateVerdict(
  client: Groq,
  topic: string,
  userPosition: "for" | "against",
  difficulty: string,
  rounds: DebateRound[]
): Promise<string> {
  const roundSummary = rounds
    .map(
      (r) =>
        `Round ${r.roundNumber}: User scored ${r.score.overall}/10 — "${r.score.feedback}"`
    )
    .join("\n");

  const avgScore =
    rounds.reduce((sum, r) => sum + r.score.overall, 0) / (rounds.length || 1);

  const prompt = `You are an expert debate judge. The user debated "${topic}" (their position: ${userPosition.toUpperCase()}) at ${difficulty} difficulty.

Round summary:
${roundSummary}

Average score: ${avgScore.toFixed(1)}/10

Write a final verdict in 3-4 sentences: acknowledge their strengths, name the biggest weakness, and give one concrete tip to improve next time. Be encouraging but honest.`;

  const result = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 350,
    messages: [{ role: "user", content: prompt }],
  });
  return result.choices[0]?.message?.content ?? "";
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {return err.message;}
  return String(err);
}

function loadHistory(filePath: string): HistoryFile {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      return JSON.parse(raw) as HistoryFile;
    }
  } catch {}
  return { sessions: [] };
}

function saveHistory(filePath: string, data: HistoryFile): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("[DebatePartner] Failed to save history:", err);
  }
}

function getWebviewContent(): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';"
  />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Debate Partner</title>
  <style>
    /* ── Reset & base ─────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --fg:          var(--vscode-editor-foreground);
      --bg:          var(--vscode-editor-background);
      --bg-panel:    var(--vscode-sideBar-background, var(--vscode-editor-background));
      --bg-input:    var(--vscode-input-background);
      --fg-input:    var(--vscode-input-foreground);
      --border:      var(--vscode-panel-border, var(--vscode-widget-border, #3c3c3c));
      --btn-bg:      var(--vscode-button-background);
      --btn-fg:      var(--vscode-button-foreground);
      --btn-hover:   var(--vscode-button-hoverBackground);
      --btn2-bg:     var(--vscode-button-secondaryBackground);
      --btn2-fg:     var(--vscode-button-secondaryForeground);
      --btn2-hover:  var(--vscode-button-secondaryHoverBackground);
      --accent:      var(--vscode-textLink-foreground, #4fc1ff);
      --warn:        var(--vscode-editorWarning-foreground, #cca700);
      --error:       var(--vscode-editorError-foreground, #f48771);
      --success:     var(--vscode-testing-iconPassed, #73c991);
      --badge-bg:    var(--vscode-badge-background);
      --badge-fg:    var(--vscode-badge-foreground);
      --placeholder: var(--vscode-input-placeholderForeground);
      --font:        var(--vscode-font-family, 'Segoe UI', system-ui, sans-serif);
      --font-mono:   var(--vscode-editor-font-family, 'Courier New', monospace);
      --font-size:   var(--vscode-font-size, 13px);
      --radius:      6px;
      --gap:         12px;
    }

    body {
      font-family: var(--font);
      font-size: var(--font-size);
      color: var(--fg);
      background: var(--bg);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }

    /* ── Layout shells ────────────────────────────────────────── */
    #app {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    .view { display: none; flex-direction: column; height: 100%; }
    .view.active { display: flex; }

    /* ── Header ───────────────────────────────────────────────── */
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-panel);
      flex-shrink: 0;
    }

    .header-left { display: flex; align-items: center; gap: 8px; }

    .logo {
      font-size: 18px;
      line-height: 1;
    }

    header h1 {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.85;
    }

    .header-right { display: flex; gap: 6px; }

    /* ── Buttons ──────────────────────────────────────────────── */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 12px;
      border-radius: var(--radius);
      border: none;
      cursor: pointer;
      font-family: var(--font);
      font-size: var(--font-size);
      font-weight: 500;
      transition: background 0.12s, opacity 0.12s;
      white-space: nowrap;
      line-height: 1.5;
    }

    .btn-primary {
      background: var(--btn-bg);
      color: var(--btn-fg);
    }
    .btn-primary:hover:not(:disabled) { background: var(--btn-hover); }

    .btn-secondary {
      background: var(--btn2-bg, rgba(255,255,255,0.07));
      color: var(--btn2-fg, var(--fg));
    }
    .btn-secondary:hover:not(:disabled) { background: var(--btn2-hover, rgba(255,255,255,0.12)); }

    .btn-ghost {
      background: transparent;
      color: var(--fg);
      opacity: 0.6;
      padding: 4px 8px;
    }
    .btn-ghost:hover { opacity: 1; background: rgba(255,255,255,0.05); }

    .btn-danger {
      background: transparent;
      color: var(--error);
      border: 1px solid currentColor;
    }
    .btn-danger:hover { background: rgba(244,135,113,0.1); }

    .btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .btn-sm { padding: 3px 8px; font-size: 11px; }

    /* ── Form elements ────────────────────────────────────────── */
    .field { display: flex; flex-direction: column; gap: 5px; }
    .field label { font-size: 11px; font-weight: 600; opacity: 0.65; text-transform: uppercase; letter-spacing: 0.06em; }

    input[type="text"], textarea, select {
      background: var(--bg-input);
      color: var(--fg-input);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 7px 10px;
      font-family: var(--font);
      font-size: var(--font-size);
      outline: none;
      width: 100%;
      transition: border-color 0.15s;
    }
    input[type="text"]:focus, textarea:focus, select:focus {
      border-color: var(--accent);
    }
    input::placeholder, textarea::placeholder { color: var(--placeholder); }
    select option { background: var(--bg-input); color: var(--fg-input); }

    textarea {
      resize: vertical;
      min-height: 80px;
      line-height: 1.55;
    }

    /* ── Toggle chips (position selector) ────────────────────── */
    .chip-group { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip {
      padding: 5px 14px;
      border-radius: 20px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--fg);
      font-family: var(--font);
      font-size: var(--font-size);
      cursor: pointer;
      transition: all 0.12s;
      opacity: 0.65;
    }
    .chip.selected, .chip:hover {
      border-color: var(--accent);
      color: var(--accent);
      opacity: 1;
      background: rgba(79,193,255,0.08);
    }

    /* ── Scrollable content area ──────────────────────────────── */
    .scroll-area {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }
    .scroll-area::-webkit-scrollbar { width: 5px; }
    .scroll-area::-webkit-scrollbar-track { background: transparent; }
    .scroll-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }

    /* ── Setup view ───────────────────────────────────────────── */
    #view-setup .scroll-area {
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 600px;
      margin: 0 auto;
    }

    .setup-hero {
      text-align: center;
      padding: 24px 0 8px;
    }
    .setup-hero .hero-icon { font-size: 40px; margin-bottom: 10px; }
    .setup-hero h2 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .setup-hero p { opacity: 0.55; font-size: 12px; line-height: 1.6; }

    .setup-card {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .difficulty-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    .diff-card {
      padding: 10px 12px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      cursor: pointer;
      transition: all 0.12s;
      opacity: 0.65;
    }
    .diff-card:hover { opacity: 0.85; border-color: var(--accent); }
    .diff-card.selected {
      border-color: var(--accent);
      background: rgba(79,193,255,0.08);
      opacity: 1;
    }
    .diff-card .diff-name {
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent);
    }
    .diff-card .diff-desc { font-size: 11px; opacity: 0.6; margin-top: 2px; }

    .start-row { display: flex; justify-content: flex-end; }

    /* ── Debate view ──────────────────────────────────────────── */
    #view-debate {
      display: none;
      flex-direction: column;
      height: 100%;
    }
    #view-debate.active { display: flex; }

    .debate-meta {
      padding: 8px 16px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-panel);
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      flex-shrink: 0;
    }

    .meta-topic {
      font-weight: 600;
      font-size: 12px;
      flex: 1;
      min-width: 120px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      background: var(--badge-bg, rgba(255,255,255,0.1));
      color: var(--badge-fg, var(--fg));
    }
    .badge-for   { background: rgba(115,201,145,0.2); color: var(--success); }
    .badge-against { background: rgba(244,135,113,0.2); color: var(--error); }
    .badge-diff  { background: rgba(204,167,0,0.2);  color: var(--warn); }

    /* Timer */
    .timer {
      font-family: var(--font-mono);
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.04em;
      min-width: 52px;
      text-align: center;
      padding: 3px 8px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--bg-input);
      transition: color 0.3s, border-color 0.3s;
    }
    .timer.warning { color: var(--warn); border-color: var(--warn); }
    .timer.danger  { color: var(--error); border-color: var(--error); }

    /* Transcript */
    .transcript {
      flex: 1;
      overflow-y: auto;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .transcript::-webkit-scrollbar { width: 5px; }
    .transcript::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }

    .bubble-row { display: flex; flex-direction: column; gap: 6px; }

    .bubble {
      max-width: 88%;
      padding: 10px 14px;
      border-radius: var(--radius);
      line-height: 1.6;
      font-size: 13px;
      position: relative;
    }

    .bubble.user {
      align-self: flex-end;
      background: rgba(79,193,255,0.12);
      border: 1px solid rgba(79,193,255,0.25);
      border-bottom-right-radius: 2px;
    }

    .bubble.ai {
      align-self: flex-start;
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-bottom-left-radius: 2px;
    }

    .bubble .bubble-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      opacity: 0.5;
      margin-bottom: 4px;
    }

    /* Score card */
    .score-card {
      align-self: flex-end;
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-width: 88%;
      font-size: 12px;
    }
    .score-card .score-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      opacity: 0.5;
    }
    .score-bars { display: flex; flex-direction: column; gap: 5px; }
    .score-bar-row { display: flex; align-items: center; gap: 8px; }
    .score-bar-label { width: 54px; font-size: 11px; opacity: 0.7; }
    .score-bar-track {
      flex: 1;
      height: 6px;
      background: rgba(255,255,255,0.08);
      border-radius: 3px;
      overflow: hidden;
    }
    .score-bar-fill {
      height: 100%;
      border-radius: 3px;
      background: var(--accent);
      transition: width 0.6s ease;
    }
    .score-bar-val { font-size: 11px; font-weight: 600; width: 22px; text-align: right; }
    .score-overall {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 6px;
      border-top: 1px solid var(--border);
      font-weight: 600;
    }
    .score-overall .val { color: var(--accent); font-size: 15px; }
    .score-feedback { opacity: 0.65; font-size: 11px; line-height: 1.5; font-style: italic; }

    /* Thinking indicator */
    .thinking {
      align-self: flex-start;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      font-size: 12px;
      opacity: 0.65;
    }
    .dots { display: flex; gap: 4px; }
    .dot {
      width: 5px; height: 5px;
      border-radius: 50%;
      background: var(--fg);
      animation: blink 1.2s infinite;
    }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes blink {
      0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
      40%            { opacity: 1;   transform: scale(1); }
    }

    /* Input area */
    .input-area {
      border-top: 1px solid var(--border);
      background: var(--bg-panel);
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
    }

    .input-row { display: flex; gap: 8px; align-items: flex-end; }
    #argument-input { flex: 1; min-height: 64px; max-height: 180px; }

    .input-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .round-indicator {
      font-size: 11px;
      opacity: 0.5;
      font-variant-numeric: tabular-nums;
    }

    /* Verdict view */
    .verdict-card {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
      margin: 14px 16px;
    }
    .verdict-card h3 {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      opacity: 0.5;
      margin-bottom: 10px;
    }
    .verdict-text { line-height: 1.7; font-size: 13px; }

    .avg-score-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid var(--border);
    }
    .big-score {
      font-size: 36px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      color: var(--accent);
      line-height: 1;
    }
    .big-score-label { font-size: 11px; opacity: 0.5; }

    /* History view */
    #view-history .scroll-area {
      padding: 14px;
    }

    .history-empty {
      text-align: center;
      padding: 40px 20px;
      opacity: 0.4;
      font-size: 13px;
    }
    .history-empty .empty-icon { font-size: 32px; margin-bottom: 8px; }

    .history-item {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--bg-panel);
      margin-bottom: 8px;
      cursor: pointer;
      transition: border-color 0.12s;
    }
    .history-item:hover { border-color: var(--accent); }

    .history-item-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }

    .history-topic { font-weight: 600; font-size: 13px; flex: 1; }
    .history-meta { display: flex; gap: 5px; flex-wrap: wrap; }

    .history-preview {
      font-size: 11px;
      opacity: 0.5;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .history-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .history-date { font-size: 10px; opacity: 0.35; }

    /* Error toast */
    .error-toast {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--error);
      color: #fff;
      padding: 8px 16px;
      border-radius: var(--radius);
      font-size: 12px;
      z-index: 100;
      max-width: 90%;
      text-align: center;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
    }
    .error-toast.visible { opacity: 1; }

    /* Utility */
    .hidden { display: none !important; }
    .text-muted { opacity: 0.5; }
    .text-accent { color: var(--accent); }
    .text-success { color: var(--success); }
    .text-error { color: var(--error); }
    .text-warn { color: var(--warn); }
    .mt-auto { margin-top: auto; }
    .flex-row { display: flex; align-items: center; gap: 8px; }
  </style>
</head>
<body>
<div id="app">

  <!-- ── Header ──────────────────────────────────────────── -->
  <header>
    <div class="header-left">
      <span class="logo">🗣️</span>
      <h1>Debate Partner</h1>
    </div>
    <div class="header-right">
      <button class="btn btn-ghost btn-sm" id="btn-history" title="View debate history">📋 History</button>
      <button class="btn btn-ghost btn-sm" id="btn-new" title="Start new debate">＋ New</button>
    </div>
  </header>

  <!-- ── View: Setup ─────────────────────────────────────── -->
  <div class="view active" id="view-setup">
    <div class="scroll-area">
      <div class="setup-hero">
        <div class="hero-icon">⚔️</div>
        <h2>Pick your battle.</h2>
        <p>State a topic, choose your side, set the intensity — then defend every word.</p>
      </div>

      <div class="setup-card">
        <div class="field">
          <label>Debate Topic</label>
          <input
            type="text"
            id="topic-input"
            placeholder="e.g. Artificial intelligence is a net benefit to society"
          />
        </div>

        <div class="field">
          <label>Your Position</label>
          <div class="chip-group">
            <button class="chip selected" data-position="for">✅ For (Pro)</button>
            <button class="chip" data-position="against">❌ Against (Con)</button>
          </div>
        </div>

        <div class="field">
          <label>Difficulty</label>
          <div class="difficulty-grid">
            <div class="diff-card" data-diff="easy">
              <div class="diff-name">🌱 Easy</div>
              <div class="diff-desc">Straightforward, beginner-friendly arguments</div>
            </div>
            <div class="diff-card selected" data-diff="medium">
              <div class="diff-name">⚡ Medium</div>
              <div class="diff-desc">Balanced rebuttals with real examples</div>
            </div>
            <div class="diff-card" data-diff="hard">
              <div class="diff-name">🔥 Hard</div>
              <div class="diff-desc">Sharp, evidence-backed counter-arguments</div>
            </div>
            <div class="diff-card" data-diff="expert">
              <div class="diff-name">💀 Expert</div>
              <div class="diff-desc">World-class rebuttals; every flaw exposed</div>
            </div>
          </div>
        </div>

        <div class="start-row">
          <button class="btn btn-primary" id="btn-start">Start Debate →</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ── View: Debate ────────────────────────────────────── -->
  <div class="view" id="view-debate">
    <!-- Meta bar -->
    <div class="debate-meta">
      <span class="meta-topic" id="debate-topic-label"></span>
      <span class="badge" id="badge-position"></span>
      <span class="badge badge-diff" id="badge-diff"></span>
      <div class="timer" id="timer">02:00</div>
      <button class="btn btn-secondary btn-sm" id="btn-end-debate">End & Score</button>
    </div>

    <!-- Transcript -->
    <div class="transcript" id="transcript"></div>

    <!-- Input area -->
    <div class="input-area">
      <div class="input-row">
        <textarea
          id="argument-input"
          placeholder="Type your argument here… (Ctrl+Enter to submit)"
        ></textarea>
        <button class="btn btn-primary" id="btn-submit">Submit</button>
      </div>
      <div class="input-actions">
        <span class="round-indicator" id="round-indicator">Round 1</span>
        <span class="text-muted" style="font-size:11px">Ctrl+Enter to submit</span>
      </div>
    </div>
  </div>

  <!-- ── View: History ───────────────────────────────────── -->
  <div class="view" id="view-history">
    <div class="scroll-area" id="history-list"></div>
  </div>

</div>

<!-- Error toast -->
<div class="error-toast" id="error-toast"></div>

<script>
(function() {
  "use strict";

  const vscode = acquireVsCodeApi();

  // ── State ──────────────────────────────────────────────────────────────────
  let state = {
    view: "setup",           // "setup" | "debate" | "history"
    sessionId: null,
    topic: "",
    position: "for",         // "for" | "against"
    difficulty: "medium",
    round: 1,
    rounds: [],
    timerSeconds: 120,
    timerHandle: null,
    timerRunning: false,
    waiting: false,          // waiting for AI response
    ended: false,
  };

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const views = { setup: $("view-setup"), debate: $("view-debate"), history: $("view-history") };

  const topicInput     = $("topic-input");
  const argumentInput  = $("argument-input");
  const transcript     = $("transcript");
  const timerEl        = $("timer");
  const roundIndicator = $("round-indicator");
  const errorToast     = $("error-toast");

  // ── View switching ─────────────────────────────────────────────────────────
  function showView(name) {
    state.view = name;
    Object.entries(views).forEach(([k, el]) => {
      el.classList.toggle("active", k === name);
    });
  }

  // ── Navigation buttons ─────────────────────────────────────────────────────
  $("btn-new").addEventListener("click", () => {
    if (state.view === "debate" && !state.ended) {
      if (!confirm("Abandon the current debate?")) { return; }
    }
    stopTimer();
    resetDebateState();
    showView("setup");
  });

  $("btn-history").addEventListener("click", () => {
    vscode.postMessage({ type: "loadHistory" });
    showView("history");
  });

  // ── Setup: position chips ──────────────────────────────────────────────────
  document.querySelectorAll(".chip[data-position]").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip[data-position]").forEach(c => c.classList.remove("selected"));
      chip.classList.add("selected");
      state.position = chip.dataset.position;
    });
  });

  // ── Setup: difficulty cards ────────────────────────────────────────────────
  document.querySelectorAll(".diff-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".diff-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      state.difficulty = card.dataset.diff;
    });
  });

  // ── Start debate ───────────────────────────────────────────────────────────
  $("btn-start").addEventListener("click", startDebate);
  topicInput.addEventListener("keydown", e => { if (e.key === "Enter") { startDebate(); } });

  function startDebate() {
    const topic = topicInput.value.trim();
    if (!topic) { showError("Please enter a debate topic first."); return; }

    state.topic     = topic;
    state.round     = 1;
    state.rounds    = [];
    state.ended     = false;
    state.waiting   = true;

    // Update meta bar
    $("debate-topic-label").textContent = topic;
    const posLabel = state.position === "for" ? "✅ Arguing For" : "❌ Arguing Against";
    const badgePos = $("badge-position");
    badgePos.textContent = posLabel;
    badgePos.className   = "badge badge-" + state.position;
    $("badge-diff").textContent = diffEmoji(state.difficulty) + " " + capitalize(state.difficulty);

    // Clear transcript
    transcript.innerHTML = "";
    appendThinking("Setting the stage…");

    // Reset & start timer
    resetTimer();
    showView("debate");
    updateRoundIndicator();
    setInputLocked(true);

    vscode.postMessage({
      type: "startDebate",
      topic: state.topic,
      userPosition: state.position,
      difficulty: state.difficulty,
    });
  }

  // ── Submit argument ────────────────────────────────────────────────────────
  $("btn-submit").addEventListener("click", submitArgument);
  argumentInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { submitArgument(); }
  });

  function submitArgument() {
    if (state.waiting || state.ended) { return; }
    const text = argumentInput.value.trim();
    if (!text) { showError("Write your argument first."); return; }

    stopTimer();
    state.waiting = true;
    argumentInput.value = "";

    // Show user bubble
    appendUserBubble(text, state.round);
    appendThinking("Rebutting…");
    setInputLocked(true);

    vscode.postMessage({
      type: "submitArgument",
      sessionId: state.sessionId,
      roundNumber: state.round,
      userArgument: text,
      topic: state.topic,
      userPosition: state.position,
      difficulty: state.difficulty,
    });
  }

  // ── End debate ─────────────────────────────────────────────────────────────
  $("btn-end-debate").addEventListener("click", endDebate);

  function endDebate() {
    if (state.ended) { return; }
    if (state.rounds.length === 0) {
      showError("Complete at least one round before ending."); return;
    }
    if (!confirm("End debate and receive your final verdict?")) { return; }

    stopTimer();
    state.ended   = true;
    state.waiting = true;
    setInputLocked(true);

    appendThinking("Deliberating final verdict…");

    vscode.postMessage({
      type: "endDebate",
      sessionId: state.sessionId,
      topic: state.topic,
      userPosition: state.position,
      difficulty: state.difficulty,
      rounds: state.rounds,
    });
  }

  // ── Timer ──────────────────────────────────────────────────────────────────
  function resetTimer() {
    stopTimer();
    state.timerSeconds = 120;
    renderTimer();
  }

  function startTimer() {
    stopTimer();
    state.timerRunning = true;
    state.timerHandle = setInterval(() => {
      state.timerSeconds--;
      renderTimer();
      if (state.timerSeconds <= 0) {
        stopTimer();
        showError("Time's up! Submit your argument.");
        argumentInput.focus();
      }
    }, 1000);
  }

  function stopTimer() {
    if (state.timerHandle) { clearInterval(state.timerHandle); state.timerHandle = null; }
    state.timerRunning = false;
  }

  function renderTimer() {
    const m = Math.floor(Math.abs(state.timerSeconds) / 60);
    const s = Math.abs(state.timerSeconds) % 60;
    timerEl.textContent = (state.timerSeconds < 0 ? "-" : "") +
      String(m).padStart(2,"0") + ":" + String(s).padStart(2,"0");
    timerEl.className = "timer" +
      (state.timerSeconds < 30 && state.timerSeconds >= 10 ? " warning" : "") +
      (state.timerSeconds < 10 ? " danger" : "");
  }

  // ── Transcript helpers ─────────────────────────────────────────────────────
  function appendUserBubble(text, round) {
    const row = document.createElement("div");
    row.className = "bubble-row";
    row.innerHTML = \`
      <div class="bubble user">
        <div class="bubble-label">Round \${round} — Your Argument</div>
        \${escHtml(text)}
      </div>
    \`;
    transcript.appendChild(row);
    scrollDown();
  }

  function appendAiBubble(text, label) {
    removeThinking();
    const row = document.createElement("div");
    row.className = "bubble-row";
    row.innerHTML = \`
      <div class="bubble ai">
        <div class="bubble-label">\${escHtml(label)}</div>
        \${escHtml(text)}
      </div>
    \`;
    transcript.appendChild(row);
    scrollDown();
  }

  function appendScoreCard(round) {
    const s = round.score;
    const pct = v => Math.round((v / 10) * 100);
    const card = document.createElement("div");
    card.className = "score-card";
    card.innerHTML = \`
      <div class="score-title">Your Score — Round \${round.roundNumber}</div>
      <div class="score-bars">
        \${scoreBar("Clarity",  s.clarity)}
        \${scoreBar("Evidence", s.evidence)}
        \${scoreBar("Logic",    s.logic)}
      </div>
      <div class="score-overall">
        <span>Overall</span>
        <span class="val">\${s.overall}/10</span>
      </div>
      <div class="score-feedback">"$\{escHtml(s.feedback)}"</div>
    \`;
    transcript.appendChild(card);
    // Animate bars
    requestAnimationFrame(() => {
      card.querySelectorAll(".score-bar-fill").forEach(fill => {
        fill.style.width = fill.dataset.pct + "%";
      });
    });
    scrollDown();

    function scoreBar(label, val) {
      return \`
        <div class="score-bar-row">
          <span class="score-bar-label">\${label}</span>
          <div class="score-bar-track">
            <div class="score-bar-fill" data-pct="\${pct(val)}" style="width:0%"></div>
          </div>
          <span class="score-bar-val">\${val}</span>
        </div>
      \`;
    }
  }

  function appendVerdictCard(verdict, rounds) {
    removeThinking();
    const avg = rounds.length
      ? (rounds.reduce((s, r) => s + r.score.overall, 0) / rounds.length).toFixed(1)
      : "N/A";

    const card = document.createElement("div");
    card.className = "verdict-card";
    card.innerHTML = \`
      <h3>🏛️ Final Verdict</h3>
      <div class="verdict-text">\${escHtml(verdict)}</div>
      <div class="avg-score-row">
        <div>
          <div class="big-score">\${avg}</div>
          <div class="big-score-label text-muted">avg score / 10</div>
        </div>
        <div style="flex:1; padding-left:12px; font-size:12px; opacity:0.6">
          across \${rounds.length} round\${rounds.length !== 1 ? "s" : ""}
        </div>
        <button class="btn btn-primary btn-sm" id="btn-new-after-verdict">New Debate</button>
      </div>
    \`;
    transcript.appendChild(card);
    scrollDown();

    document.getElementById("btn-new-after-verdict").addEventListener("click", () => {
      resetDebateState();
      showView("setup");
    });
  }

  function appendThinking(label) {
    removeThinking();
    const el = document.createElement("div");
    el.id = "thinking-indicator";
    el.className = "thinking";
    el.innerHTML = \`
      <div class="dots">
        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
      </div>
      \${escHtml(label)}
    \`;
    transcript.appendChild(el);
    scrollDown();
  }

  function removeThinking() {
    const el = document.getElementById("thinking-indicator");
    if (el) { el.remove(); }
  }

  function scrollDown() {
    transcript.scrollTop = transcript.scrollHeight;
  }

  // ── History rendering ──────────────────────────────────────────────────────
  function renderHistory(sessions) {
    const list = $("history-list");
    if (!sessions || sessions.length === 0) {
      list.innerHTML = \`
        <div class="history-empty">
          <div class="empty-icon">📭</div>
          <div>No debates yet. Start one to build your history.</div>
        </div>
      \`;
      return;
    }

    list.innerHTML = "";
    sessions.forEach(session => {
      const item = document.createElement("div");
      item.className = "history-item";

      const roundsCount = session.rounds?.length || 0;
      const avgScore = roundsCount
        ? (session.rounds.reduce((s, r) => s + (r.score?.overall || 0), 0) / roundsCount).toFixed(1)
        : null;
      const preview = session.finalVerdict || (roundsCount > 0 ? session.rounds[0].userArgument : "No arguments recorded.");
      const dateStr = new Date(session.startedAt).toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric"
      });

      item.innerHTML = \`
        <div class="history-item-top">
          <div class="history-topic">\${escHtml(session.topic)}</div>
          <div class="history-meta">
            <span class="badge badge-\${session.userPosition}">\${session.userPosition === "for" ? "For" : "Against"}</span>
            <span class="badge badge-diff">\${diffEmoji(session.difficulty)} \${capitalize(session.difficulty)}</span>
            \${avgScore ? \`<span class="badge" style="color:var(--accent)">⭐ \${avgScore}</span>\` : ""}
          </div>
        </div>
        <div class="history-preview">\${escHtml(preview)}</div>
        <div class="history-bottom">
          <span class="history-date">\${dateStr} · \${roundsCount} round\${roundsCount !== 1 ? "s" : ""}</span>
          <button class="btn btn-danger btn-sm" data-id="\${session.id}">Delete</button>
        </div>
      \`;

      item.querySelector(".btn-danger").addEventListener("click", e => {
        e.stopPropagation();
        if (confirm("Delete this debate session?")) {
          vscode.postMessage({ type: "deleteSession", sessionId: session.id });
        }
      });

      list.appendChild(item);
    });
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────
  function setInputLocked(locked) {
    argumentInput.disabled = locked;
    $("btn-submit").disabled = locked;
    $("btn-end-debate").disabled = locked;
  }

  function updateRoundIndicator() {
    roundIndicator.textContent = \`Round \${state.round}\`;
  }

  function resetDebateState() {
    stopTimer();
    state.sessionId  = null;
    state.topic      = "";
    state.round      = 1;
    state.rounds     = [];
    state.ended      = false;
    state.waiting    = false;
    transcript.innerHTML = "";
    argumentInput.value  = "";
    topicInput.value     = "";
    setInputLocked(false);
  }

  let toastHandle = null;
  function showError(msg) {
    errorToast.textContent = msg;
    errorToast.classList.add("visible");
    if (toastHandle) { clearTimeout(toastHandle); }
    toastHandle = setTimeout(() => errorToast.classList.remove("visible"), 4000);
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/\\n/g, "<br>");
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function diffEmoji(d) {
    return { easy: "🌱", medium: "⚡", hard: "🔥", expert: "💀" }[d] || "⚡";
  }

  // ── Message handler (backend → frontend) ───────────────────────────────────
  window.addEventListener("message", event => {
    const msg = event.data;
    switch (msg.type) {

      case "debateStarted":
        state.sessionId = msg.sessionId;
        // Still waiting for AI opening statement
        break;

      case "aiOpening":
        state.waiting = false;
        appendAiBubble(msg.text, "⚔️ AI Opening Statement");
        setInputLocked(false);
        resetTimer();
        startTimer();
        argumentInput.focus();
        break;

      case "roundResult": {
        const round = msg.round;
        state.rounds.push(round);
        removeThinking();
        // Show score card first (above AI rebuttal)
        appendScoreCard(round);
        // Then AI rebuttal
        appendAiBubble(round.aiRebuttal, \`⚔️ AI Rebuttal — Round \${round.roundNumber}\`);
        // Advance round
        state.round++;
        state.waiting = false;
        updateRoundIndicator();
        resetTimer();
        startTimer();
        setInputLocked(false);
        argumentInput.focus();
        break;
      }

      case "debateEnded":
        state.waiting = false;
        appendVerdictCard(msg.verdict, state.rounds);
        setInputLocked(true);
        stopTimer();
        break;

      case "history":
        renderHistory(msg.sessions);
        break;

      case "error":
        state.waiting = false;
        removeThinking();
        setInputLocked(false);
        showError(msg.message || "An error occurred.");
        break;
    }
  });

})();
</script>
</body>
</html>`;
}