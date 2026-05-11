/**
 * HackStack — demo dataset
 *
 * Single source of truth for demo content. Consumed by:
 *   - backend/pb_migrations/1777600000_demo_seed.js   (PocketBase JSVM migration)
 *   - frontend/scripts/seed.ts                         (Node script via the JS SDK)
 *
 * Every record carries a deterministic 15-char [a-z0-9] id so re-running the
 * seed never duplicates rows — both surfaces upsert by id.
 *
 * Conventions:
 *   - Lecture ids:   demolec{course}{nn}   (15 chars)
 *   - Transcript ids:demotrn{course}{nn}
 *   - Note ids:      demonot{course}{nn}
 *   - Flashcard ids: demofc{course}{nn}{ii}  (ii = 01..12)
 *   - Quiz ids:      demoqz{course}{nn}{0}
 *   - Session ids:   demosess000000{n}   (n = 0..4)
 *
 * Dates are computed at seed time so the streak is always "today minus N".
 *
 * @typedef {{
 *   user: { id: string, email: string, password: string, display_name: string, onboarding_done: boolean, badges?: Array<{ label: string, backgroundColor: string, textColor?: string, borderColor?: string }> },
 *   courses: Array<{ id: string, name: string, code: string, color: string, semester: string }>,
 *   lectures: Array<{ id: string, course_id: string, title: string, duration_secs: number, days_ago: number }>,
 *   transcripts: Array<{ id: string, lecture_id: string, raw_text: string, clean_text: string, segments: any[], language: string, word_count: number }>,
 *   notes: Array<{ id: string, lecture_id: string, title: string, content: any[], summary: string, key_concepts: any[] }>,
 *   flashcards: Array<{ id: string, lecture_id: string, deck_name: string, front: string, back: string, tags: string[], difficulty: string }>,
 *   quizzes: Array<{ id: string, lecture_id: string, title: string, questions: any[], total_points: number }>,
 *   study_sessions: Array<{ id: string, lecture_id: string, days_ago: number, duration_secs: number, cards_reviewed: number, cards_correct: number }>
 * }} DemoData
 */

const USER_ID = "demouser0000001";

const COURSE_IDS = {
  bio: "democoursebio01",
  cog: "democoursecog01",
  mth: "democoursemth01",
};

const LECTURES = [
  { id: "demolecbio01001", course_id: COURSE_IDS.bio, course_code: "BIO 201",  title: "Cell Membrane Transport",        duration_secs: 1620, days_ago: 12 },
  { id: "demolecbio02002", course_id: COURSE_IDS.bio, course_code: "BIO 201",  title: "Photosynthesis Light Reactions", duration_secs: 2280, days_ago: 7  },
  { id: "demoleccog01001", course_id: COURSE_IDS.cog, course_code: "COGS 101", title: "Theories of Consciousness",      duration_secs: 1980, days_ago: 9  },
  { id: "demoleccog02002", course_id: COURSE_IDS.cog, course_code: "COGS 101", title: "Memory & Forgetting",            duration_secs: 1740, days_ago: 4  },
  { id: "demolecmth01001", course_id: COURSE_IDS.mth, course_code: "MATH 1B",  title: "Eigenvalues & Eigenvectors",     duration_secs: 2520, days_ago: 2  },
];

// ──────────────────────────────────────────────────────────────────────────
// Transcripts — 3-4 paragraphs of plausible content per lecture, 60-90 words
// each. clean_text is a polished pass of raw_text. Segments are 6+ per
// lecture with realistic timestamps.
// ──────────────────────────────────────────────────────────────────────────

const TRANSCRIPT_TEXT = {
  demolecbio01001: {
    raw: [
      "Okay so today we're talking about how stuff actually crosses the plasma membrane. The membrane is basically a phospholipid bilayer with proteins stuck in it, and the key idea is that the interior is hydrophobic, so it's selectively permeable. Small nonpolar molecules like oxygen or carbon dioxide just diffuse straight through, but ions and polar molecules need help, and that's where transport proteins come in.",
      "There are two big categories: passive transport and active transport. Passive transport moves stuff down its concentration gradient, no ATP required — that includes simple diffusion, facilitated diffusion through channels or carriers, and osmosis for water. Active transport moves things against the gradient and burns ATP, either directly like the sodium-potassium pump or indirectly by coupling to a gradient another pump set up.",
      "The sodium-potassium pump is worth memorizing because it shows up everywhere — three sodiums out, two potassiums in, one ATP hydrolyzed. That asymmetry is what creates the membrane potential that nerve cells use to fire action potentials. So this little pump is doing a huge amount of work in your body right now, in basically every cell, and it accounts for a serious chunk of your basal metabolic rate.",
      "Last thing — bulk transport. When stuff is too big for any channel, the cell uses endocytosis to engulf it, or exocytosis to spit it out. Phagocytosis is the cell-eating version, pinocytosis is the cell-drinking version, and receptor-mediated endocytosis is the targeted version where a ligand binds and triggers vesicle formation. We'll dig into vesicle trafficking next week.",
    ],
    segments: [
      { start: 0,    end: 75,   text: "Today we're talking about how stuff actually crosses the plasma membrane.", confidence: 0.96 },
      { start: 75,   end: 240,  text: "The membrane is a phospholipid bilayer with proteins; the interior is hydrophobic, so it's selectively permeable.", confidence: 0.95 },
      { start: 240,  end: 480,  text: "Passive transport moves things down a gradient with no ATP — simple diffusion, facilitated diffusion, osmosis.", confidence: 0.97 },
      { start: 480,  end: 720,  text: "Active transport moves against the gradient and burns ATP, like the sodium-potassium pump.", confidence: 0.96 },
      { start: 720,  end: 1080, text: "Three sodiums out, two potassiums in, one ATP — this builds the membrane potential nerves rely on.", confidence: 0.94 },
      { start: 1080, end: 1380, text: "Endocytosis engulfs large stuff; exocytosis releases it. Phagocytosis, pinocytosis, receptor-mediated.", confidence: 0.95 },
      { start: 1380, end: 1620, text: "Next week we'll dig into vesicle trafficking and the endomembrane system.", confidence: 0.93 },
    ],
  },
  demolecbio02002: {
    raw: [
      "Photosynthesis converts light energy into chemical energy, and today we're focusing on the light-dependent reactions — the part that actually captures photons. These reactions happen in the thylakoid membrane of the chloroplast, and they need light to run, which is why your houseplants stop producing oxygen at night. The two main protein complexes you need to know are Photosystem II and Photosystem I, in that confusing reverse order.",
      "Photosystem II absorbs a photon, an electron in chlorophyll gets excited, and that electron is passed down an electron transport chain. To replace the electron, PSII rips one off of water — that's where the oxygen we breathe comes from, as a byproduct of splitting H2O. The electron transport chain pumps protons into the thylakoid lumen, building a gradient that ATP synthase uses to make ATP, which is called photophosphorylation.",
      "Photosystem I picks up that electron, absorbs another photon to re-excite it, and ultimately uses it to reduce NADP+ to NADPH. So the net products of the light reactions are ATP and NADPH, plus oxygen as the waste product. These two molecules then carry the captured energy into the stroma, where the Calvin cycle uses them to fix carbon dioxide into sugar — but that's next lecture.",
      "Quick note on cyclic versus non-cyclic flow. The pathway I just described is non-cyclic and produces both ATP and NADPH. In cyclic photophosphorylation, electrons loop back from PSI to the chain and only ATP is made. Plants use cyclic flow when they have plenty of NADPH but still need ATP, so it's a balancing mechanism for the energy supply ratio.",
    ],
    segments: [
      { start: 0,    end: 120,  text: "Photosynthesis converts light into chemical energy. Today: the light-dependent reactions.", confidence: 0.96 },
      { start: 120,  end: 360,  text: "These reactions happen in the thylakoid membrane and require light to run.", confidence: 0.96 },
      { start: 360,  end: 720,  text: "Photosystem II absorbs a photon, excites an electron, sends it down the transport chain.", confidence: 0.95 },
      { start: 720,  end: 1080, text: "PSII replaces electrons by splitting water — that's the source of atmospheric oxygen.", confidence: 0.94 },
      { start: 1080, end: 1500, text: "Proton pumping builds the gradient ATP synthase uses to make ATP.", confidence: 0.96 },
      { start: 1500, end: 1860, text: "Photosystem I uses a second photon to reduce NADP+ to NADPH.", confidence: 0.95 },
      { start: 1860, end: 2160, text: "Net products: ATP, NADPH, and oxygen as waste.", confidence: 0.97 },
      { start: 2160, end: 2280, text: "Cyclic vs non-cyclic flow lets the chloroplast tune its ATP-to-NADPH ratio.", confidence: 0.93 },
    ],
  },
  demoleccog01001: {
    raw: [
      "Consciousness is one of the hardest problems in cognitive science because we're using a conscious mind to study itself, which is a little like a flashlight trying to illuminate its own bulb. Today we'll go through three of the dominant theories — Global Workspace Theory, Integrated Information Theory, and Higher-Order Thought theory — and see what each one tries to explain and where they disagree.",
      "Global Workspace Theory, from Baars and developed further by Dehaene, treats consciousness like a stage. Most cognitive processing is unconscious and modular, but when information is selected and broadcast to a global workspace, it becomes conscious — meaning many brain systems can access it simultaneously. This explains why we can only consciously attend to one thing at a time even while a lot of unconscious work happens in parallel.",
      "Integrated Information Theory, or IIT, takes a really different angle. Tononi argues consciousness is identical to integrated information, which he calls phi. Any system that integrates information enough has some level of consciousness — including, controversially, simple physical systems. The strength of IIT is that it makes precise mathematical predictions, but the weakness is that it's almost impossible to measure phi in real brains.",
      "Higher-Order Thought theory says a mental state is conscious only if you also have a thought about that state — a thought about a thought. So pain becomes conscious pain when there's a higher-order representation of it. Critics say this leads to infinite regress, but defenders argue the higher-order thought doesn't need to itself be conscious, just present. We'll bring all three back when we cover blindsight.",
    ],
    segments: [
      { start: 0,    end: 180,  text: "Consciousness is hard because we use a conscious mind to study itself.", confidence: 0.94 },
      { start: 180,  end: 420,  text: "Today: Global Workspace Theory, Integrated Information Theory, Higher-Order Thought theory.", confidence: 0.96 },
      { start: 420,  end: 780,  text: "Global Workspace: information becomes conscious when broadcast to a shared workspace.", confidence: 0.95 },
      { start: 780,  end: 1140, text: "Most processing is unconscious; only the broadcast contents enter awareness.", confidence: 0.94 },
      { start: 1140, end: 1500, text: "IIT identifies consciousness with integrated information, phi.", confidence: 0.93 },
      { start: 1500, end: 1740, text: "IIT predicts even simple integrated systems have some consciousness — controversial.", confidence: 0.91 },
      { start: 1740, end: 1980, text: "Higher-Order Thought: a state is conscious if a thought about it exists.", confidence: 0.94 },
    ],
  },
  demoleccog02002: {
    raw: [
      "Memory isn't a single system — it's a family of systems with different timescales, neural substrates, and failure modes. The classic divide is sensory memory at sub-second range, short-term or working memory at seconds, and long-term memory which persists indefinitely. Long-term memory then splits into declarative — episodic and semantic — and non-declarative, which includes procedural memory like riding a bike.",
      "Forgetting is not just a failure of storage; it's an active process. Ebbinghaus's classic forgetting curve shows that memory decays rapidly at first then levels off, but spaced repetition can dramatically flatten that curve. The testing effect is even stronger than re-reading — the act of retrieval itself strengthens the memory trace, which is why active recall flashcards beat passive highlighting.",
      "There are at least three competing reasons we forget. Decay theory says traces fade over time. Interference theory says new memories disrupt old ones, or vice versa. And retrieval failure theory says the trace is intact but the cue isn't matching, which explains tip-of-the-tongue states where the information is clearly stored. Most modern accounts use a combination of all three.",
      "Practical takeaway for studying — interleave topics, space your reviews, and self-test rather than re-read. The brain treats easy retrieval as evidence the material is already learned and stops investing, while a hard retrieval signals the trace is weak and triggers consolidation. So if your studying feels too easy, you're probably not building durable memory.",
    ],
    segments: [
      { start: 0,    end: 180,  text: "Memory is a family of systems with different timescales and substrates.", confidence: 0.96 },
      { start: 180,  end: 480,  text: "Sensory memory, short-term/working memory, long-term memory.", confidence: 0.95 },
      { start: 480,  end: 720,  text: "Long-term splits into declarative (episodic, semantic) and non-declarative (procedural).", confidence: 0.95 },
      { start: 720,  end: 1080, text: "Forgetting follows Ebbinghaus's curve; spaced repetition flattens it.", confidence: 0.94 },
      { start: 1080, end: 1380, text: "Testing effect: retrieval strengthens memory more than re-reading.", confidence: 0.96 },
      { start: 1380, end: 1620, text: "Three theories of forgetting: decay, interference, retrieval failure.", confidence: 0.94 },
      { start: 1620, end: 1740, text: "Study strategy: interleave, space, self-test.", confidence: 0.95 },
    ],
  },
  demolecmth01001: {
    raw: [
      "Eigenvalues and eigenvectors are everywhere in linear algebra and applied math, so it's worth getting the intuition before the mechanics. The idea is simple. For a square matrix A, an eigenvector v is a nonzero vector such that A times v equals lambda times v, where lambda is a scalar called the eigenvalue. Geometrically, A acts on v by just stretching or compressing it without rotating — v lies on a special invariant axis of the transformation.",
      "To find eigenvalues, we solve the characteristic equation: determinant of A minus lambda I equals zero. For a 2x2 matrix this gives a quadratic, for 3x3 a cubic, and so on. Once you have lambda, you find the corresponding eigenvector by solving A minus lambda I times v equals zero — which is a null space problem. The eigenvectors of distinct eigenvalues are linearly independent, which is what makes diagonalization possible.",
      "When a matrix has n linearly independent eigenvectors, you can write A as P D P inverse, where D is diagonal and P's columns are the eigenvectors. This is huge — diagonal matrices are trivial to compute powers of, and that lets us solve recurrences like Fibonacci in closed form, simulate Markov chains in steady state, and analyze stability of dynamical systems by looking at the magnitude of each eigenvalue.",
      "Last thing — eigenvalues need not be real. Rotation matrices have complex eigenvalues, and that's a feature, not a bug. The complex pair tells you the rotation angle and any contraction or expansion along the way. Symmetric matrices on the other hand always have real eigenvalues and orthogonal eigenvectors, which is the spectral theorem and the foundation for things like principal component analysis.",
    ],
    segments: [
      { start: 0,    end: 240,  text: "Eigenvectors lie on invariant axes — A stretches them without rotating.", confidence: 0.96 },
      { start: 240,  end: 600,  text: "A times v equals lambda times v, where lambda is the eigenvalue.", confidence: 0.97 },
      { start: 600,  end: 1080, text: "Find eigenvalues by solving det(A - lambda I) = 0.", confidence: 0.96 },
      { start: 1080, end: 1500, text: "Find eigenvectors by computing the null space of A - lambda I.", confidence: 0.95 },
      { start: 1500, end: 1920, text: "Diagonalization writes A as P D P inverse — huge for matrix powers.", confidence: 0.95 },
      { start: 1920, end: 2280, text: "Applications: Fibonacci closed form, Markov chains, stability analysis.", confidence: 0.94 },
      { start: 2280, end: 2520, text: "Symmetric matrices have real eigenvalues and orthogonal eigenvectors — spectral theorem.", confidence: 0.96 },
    ],
  },
};

function buildTranscripts() {
  const out = [];
  const transcriptIds = {
    demolecbio01001: "demotrnbio01001",
    demolecbio02002: "demotrnbio02002",
    demoleccog01001: "demotrncog01001",
    demoleccog02002: "demotrncog02002",
    demolecmth01001: "demotrnmth01001",
  };
  for (const lec of LECTURES) {
    const t = TRANSCRIPT_TEXT[lec.id];
    const raw = t.raw.join("\n\n");
    const clean = t.raw.map(polish).join("\n\n");
    out.push({
      id: transcriptIds[lec.id],
      lecture_id: lec.id,
      raw_text: raw,
      clean_text: clean,
      segments: t.segments,
      language: "en",
      word_count: clean.split(/\s+/).filter(Boolean).length,
    });
  }
  return out;
}

function polish(p) {
  // Lightly polish raw transcript: remove filler words, sentence-case nicely.
  return p
    .replace(/\bokay so\b/gi, "")
    .replace(/\bbasically\b/gi, "essentially")
    .replace(/\byou know\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .replace(/^([a-z])/, (_, c) => c.toUpperCase());
}

// ──────────────────────────────────────────────────────────────────────────
// Notes — one per lecture. Block layout:
// 1 heading, 2 paragraph, 1 bullet_list (3 items), 2 key_term, 1 callout(tip)
// ──────────────────────────────────────────────────────────────────────────

const NOTES = [
  {
    id: "demonotbio01001",
    lecture_id: "demolecbio01001",
    title: "Cell Membrane Transport — Notes",
    summary: "Selective permeability of the plasma membrane drives passive, active, and bulk transport, with the sodium-potassium pump providing the cell's electrochemical baseline.",
    key_concepts: [
      { term: "Selective permeability", definition: "The hydrophobic interior of the bilayer lets nonpolar molecules pass but blocks ions and polar molecules, requiring transport proteins.", importance: "high" },
      { term: "Sodium-potassium pump",   definition: "ATP-driven antiporter that exchanges 3 Na+ out for 2 K+ in, establishing the resting membrane potential.", importance: "high" },
      { term: "Endocytosis vs exocytosis", definition: "Bulk transport mechanisms that move material too large for channels via vesicle formation or fusion.", importance: "medium" },
    ],
    content: [
      { id: "h1", type: "heading", level: 1, text: "Cell Membrane Transport" },
      { id: "p1", type: "paragraph", text: "The plasma membrane is a phospholipid bilayer with embedded proteins. Its hydrophobic core makes it selectively permeable: small nonpolar molecules (O2, CO2) cross freely, while ions and polar molecules need dedicated transport proteins." },
      { id: "p2", type: "paragraph", text: "Transport falls into two regimes. Passive transport (simple diffusion, facilitated diffusion, osmosis) follows the concentration gradient and costs no ATP. Active transport pushes against the gradient and consumes ATP either directly (primary) or by coupling to an existing gradient (secondary)." },
      { id: "bl1", type: "bullet_list", items: [
        "Simple diffusion — direct passage of small nonpolar molecules through the bilayer.",
        "Facilitated diffusion — channel or carrier proteins ferry polar molecules and ions down their gradient.",
        "Active transport — ATP-driven pumps move solutes uphill, e.g. Na+/K+ pump, Ca2+ ATPase.",
      ]},
      { id: "kt1", type: "key_term", term: "Membrane potential", definition: "The voltage difference across the plasma membrane, maintained by ion pumps and selective channels, used by neurons to fire action potentials." },
      { id: "kt2", type: "key_term", term: "Receptor-mediated endocytosis", definition: "Targeted bulk uptake where ligand binding clusters receptors into clathrin-coated pits that bud inward as vesicles." },
      { id: "co1", type: "callout", variant: "tip", text: "When a question mentions a 3:2 stoichiometry, it's almost always about the Na+/K+ pump and its contribution to resting potential." },
    ],
  },
  {
    id: "demonotbio02002",
    lecture_id: "demolecbio02002",
    title: "Photosynthesis: Light Reactions — Notes",
    summary: "Light reactions in the thylakoid membrane convert photons into ATP and NADPH while splitting water to release O2 as a byproduct.",
    key_concepts: [
      { term: "Photosystem II", definition: "Pigment-protein complex that uses absorbed light energy to extract electrons from water, releasing O2.", importance: "high" },
      { term: "Photophosphorylation", definition: "ATP synthesis driven by the proton gradient established by the photosynthetic electron transport chain.", importance: "high" },
      { term: "NADPH", definition: "Reducing agent produced by Photosystem I; carries energetic electrons to the Calvin cycle.", importance: "high" },
    ],
    content: [
      { id: "h1", type: "heading", level: 1, text: "Photosynthesis: Light Reactions" },
      { id: "p1", type: "paragraph", text: "The light-dependent reactions occur in the thylakoid membrane. Light excites electrons in chlorophyll, which then travel down an electron transport chain that pumps H+ into the lumen, generating the gradient that powers ATP synthase." },
      { id: "p2", type: "paragraph", text: "Photosystem II splits water (2 H2O → O2 + 4 H+ + 4 e-) to replace lost electrons — that's the source of all atmospheric oxygen. Photosystem I re-energizes electrons with a second photon and reduces NADP+ to NADPH, which the Calvin cycle later uses to fix CO2." },
      { id: "bl1", type: "bullet_list", items: [
        "Inputs: photons, water, NADP+, ADP + Pi.",
        "Outputs: O2 (waste), ATP, NADPH.",
        "Location: thylakoid membrane and lumen of the chloroplast.",
      ]},
      { id: "kt1", type: "key_term", term: "Z scheme", definition: "Diagram of electron flow from H2O through PSII, the cytochrome complex, PSI, and finally to NADP+, named for the zigzag energy profile." },
      { id: "kt2", type: "key_term", term: "Cyclic photophosphorylation", definition: "Electrons loop from PSI back into the transport chain producing ATP only — used when the cell already has enough NADPH." },
      { id: "co1", type: "callout", variant: "tip", text: "If a question asks where atmospheric O2 came from, the answer is always Photosystem II splitting water — never PSI." },
    ],
  },
  {
    id: "demonotcog01001",
    lecture_id: "demoleccog01001",
    title: "Theories of Consciousness — Notes",
    summary: "Three major theories — Global Workspace, IIT, and Higher-Order Thought — frame consciousness as broadcast access, integrated information, or a thought about a thought.",
    key_concepts: [
      { term: "Global Workspace Theory", definition: "Consciousness arises when information is broadcast from local processors to a brain-wide workspace accessible to many systems.", importance: "high" },
      { term: "Integrated Information Theory (IIT)", definition: "Consciousness is identical to integrated information (phi); any sufficiently integrated system is conscious to some degree.", importance: "high" },
      { term: "Higher-Order Thought theory", definition: "A mental state is conscious only if accompanied by a higher-order representation of that state.", importance: "medium" },
    ],
    content: [
      { id: "h1", type: "heading", level: 1, text: "Theories of Consciousness" },
      { id: "p1", type: "paragraph", text: "Cognitive science currently entertains several competing theories of consciousness. They differ on whether consciousness is a property of broadcast access, of intrinsic information geometry, or of meta-cognition." },
      { id: "p2", type: "paragraph", text: "Global Workspace Theory (Baars, Dehaene) compares consciousness to a stage where one performance is in the spotlight while many backstage processes work in parallel. Only the spotlit content is consciously accessible; the rest is unconscious processing." },
      { id: "bl1", type: "bullet_list", items: [
        "GWT — content becomes conscious by being broadcast widely across the brain.",
        "IIT — consciousness measured by phi, the irreducible integrated information.",
        "HOT — a state is conscious if there's a thought about that state.",
      ]},
      { id: "kt1", type: "key_term", term: "Phi (Φ)", definition: "Tononi's measure of integrated information; the amount by which a system as a whole exceeds the sum of its parts in informational terms." },
      { id: "kt2", type: "key_term", term: "Blindsight", definition: "Phenomenon where patients with V1 damage respond to visual stimuli they report not consciously seeing — a key test case for theories." },
      { id: "co1", type: "callout", variant: "tip", text: "On the exam: if the question mentions \"broadcast\" or \"workspace\" — GWT. \"phi\" or \"integrated\" — IIT. \"thought about a thought\" — HOT." },
    ],
  },
  {
    id: "demonotcog02002",
    lecture_id: "demoleccog02002",
    title: "Memory & Forgetting — Notes",
    summary: "Memory comprises multiple subsystems and forgetting is shaped by decay, interference, and retrieval failure — making active recall and spacing the strongest study levers.",
    key_concepts: [
      { term: "Testing effect", definition: "Active retrieval strengthens memory more than passive re-reading; spaced retrieval beats massed retrieval.", importance: "high" },
      { term: "Forgetting curve", definition: "Ebbinghaus's exponential decay of recall over time after a single exposure; flattened by spaced repetition.", importance: "high" },
      { term: "Retrieval failure", definition: "The trace exists but the cue used at retrieval fails to access it — explains tip-of-the-tongue states.", importance: "medium" },
    ],
    content: [
      { id: "h1", type: "heading", level: 1, text: "Memory & Forgetting" },
      { id: "p1", type: "paragraph", text: "Memory isn't a single system but a hierarchy: sensory memory at the millisecond scale, short-term/working memory at seconds, and long-term memory that persists indefinitely. Long-term memory itself splits into declarative (episodic and semantic) and non-declarative (procedural, priming, conditioning)." },
      { id: "p2", type: "paragraph", text: "Forgetting is active. Ebbinghaus's curve shows recall drops sharply within hours of learning, but each spaced review resets and flattens the curve, building durable representations. The testing effect — actively retrieving the answer — beats passive review at the same time cost." },
      { id: "bl1", type: "bullet_list", items: [
        "Decay — memory traces fade over time without rehearsal.",
        "Interference — new learning disrupts old (retroactive) or vice versa (proactive).",
        "Retrieval failure — the trace is intact, but the current cue can't reach it.",
      ]},
      { id: "kt1", type: "key_term", term: "Working memory", definition: "Limited-capacity active store (~4 chunks) that holds and manipulates information for current cognitive tasks (Baddeley, Cowan)." },
      { id: "kt2", type: "key_term", term: "Spaced repetition", definition: "Scheduling reviews at expanding intervals so each review occurs near the edge of forgetting — exploits the spacing effect for long-term retention." },
      { id: "co1", type: "callout", variant: "tip", text: "If your studying feels easy, the brain stops investing in consolidation. Choose hard retrieval over easy re-reading." },
    ],
  },
  {
    id: "demonotmth01001",
    lecture_id: "demolecmth01001",
    title: "Eigenvalues & Eigenvectors — Notes",
    summary: "Eigenvectors are invariant directions of a linear map; eigenvalues are the scaling factors. Together they enable diagonalization and unlock applications across ML, physics, and dynamical systems.",
    key_concepts: [
      { term: "Eigenvalue equation", definition: "A v = λ v: the matrix A acts on eigenvector v by simple scaling, with no rotation.", importance: "high" },
      { term: "Characteristic polynomial", definition: "det(A − λ I) = 0; its roots are the eigenvalues of A.", importance: "high" },
      { term: "Diagonalization", definition: "A = P D P⁻¹ where D is diagonal of eigenvalues and P's columns are independent eigenvectors.", importance: "high" },
    ],
    content: [
      { id: "h1", type: "heading", level: 1, text: "Eigenvalues & Eigenvectors" },
      { id: "p1", type: "paragraph", text: "Given a square matrix A, an eigenvector v is a nonzero vector for which A v = λ v. The scalar λ is the corresponding eigenvalue. Geometrically, A acts on v by stretching or compressing it without changing its direction — v lies on an invariant axis." },
      { id: "p2", type: "paragraph", text: "Eigenvalues are found by solving det(A − λ I) = 0. Each root yields an eigenspace via the null space of A − λ I. Eigenvectors of distinct eigenvalues are linearly independent, which is precisely what makes diagonalization possible." },
      { id: "bl1", type: "bullet_list", items: [
        "Step 1 — form A − λ I and compute its determinant.",
        "Step 2 — solve the characteristic polynomial for λ.",
        "Step 3 — for each λ, find the null space of A − λ I to get the eigenvectors.",
      ]},
      { id: "kt1", type: "key_term", term: "Spectral theorem", definition: "Every real symmetric matrix is orthogonally diagonalizable: it has real eigenvalues and an orthonormal eigenvector basis." },
      { id: "kt2", type: "key_term", term: "Algebraic vs geometric multiplicity", definition: "Algebraic = how many times λ appears as a root. Geometric = dimension of its eigenspace. Diagonalizable iff they match for every eigenvalue." },
      { id: "co1", type: "callout", variant: "tip", text: "When you see Aⁿ for large n, diagonalize first: Aⁿ = P Dⁿ P⁻¹, and Dⁿ is just each diagonal entry raised to the n." },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Flashcards — 12 per lecture: 4 easy, 5 medium, 3 hard.
// ──────────────────────────────────────────────────────────────────────────

const FLASHCARDS_BY_LECTURE = {
  demolecbio01001: [
    { front: "What is the plasma membrane primarily made of?",                           back: "A phospholipid bilayer with embedded proteins.",                                                        difficulty: "easy" },
    { front: "Define passive transport.",                                                back: "Movement of solutes down their concentration gradient without ATP.",                                  difficulty: "easy" },
    { front: "Define active transport.",                                                 back: "Movement of solutes against their gradient using ATP energy.",                                          difficulty: "easy" },
    { front: "Which gas crosses membranes by simple diffusion?",                         back: "Small nonpolar gases like O2 and CO2.",                                                                  difficulty: "easy" },
    { front: "What does the Na+/K+ pump move per ATP?",                                  back: "3 sodium ions out of the cell, 2 potassium ions in.",                                                    difficulty: "medium" },
    { front: "What is osmosis?",                                                         back: "The passive movement of water across a selectively permeable membrane down its water-potential gradient.", difficulty: "medium" },
    { front: "Difference between channel and carrier proteins?",                         back: "Channels form an open pore for ions; carriers bind solute and undergo a conformational change.",      difficulty: "medium" },
    { front: "What is receptor-mediated endocytosis?",                                   back: "Targeted vesicle uptake triggered by ligand binding to a clustered receptor patch.",                  difficulty: "medium" },
    { front: "Why is the membrane called \"selectively permeable\"?",                    back: "The hydrophobic core blocks polar/charged species while letting small nonpolar molecules pass.",     difficulty: "medium" },
    { front: "How does secondary active transport differ from primary?",                 back: "Primary uses ATP directly; secondary couples solute movement to a gradient another pump established.", difficulty: "hard" },
    { front: "Which transport mode generates the resting membrane potential?",           back: "The Na+/K+ pump combined with selective K+ leak channels.",                                              difficulty: "hard" },
    { front: "Why does endocytosis require energy even though it appears spontaneous?",  back: "Membrane bending and vesicle scission depend on ATP-/GTP-driven proteins like dynamin.",              difficulty: "hard" },
  ],
  demolecbio02002: [
    { front: "Where do the light reactions occur?",                                      back: "In the thylakoid membrane of the chloroplast.",                                                          difficulty: "easy" },
    { front: "What molecule is split during the light reactions?",                       back: "Water (H2O).",                                                                                            difficulty: "easy" },
    { front: "Name the two photosystems.",                                               back: "Photosystem II and Photosystem I.",                                                                      difficulty: "easy" },
    { front: "What gas is released as a byproduct?",                                     back: "Oxygen (O2).",                                                                                            difficulty: "easy" },
    { front: "What two energy carriers do the light reactions produce?",                 back: "ATP and NADPH.",                                                                                          difficulty: "medium" },
    { front: "What pigment absorbs photons in the photosystems?",                        back: "Chlorophyll a (with accessory pigments funneling energy into it).",                                       difficulty: "medium" },
    { front: "Where does ATP synthase get energy from?",                                 back: "From the proton gradient across the thylakoid membrane.",                                                difficulty: "medium" },
    { front: "What does PSI reduce to make NADPH?",                                      back: "NADP+ (using ferredoxin and NADP+ reductase).",                                                          difficulty: "medium" },
    { front: "Why is electron flow called \"non-cyclic\" in the standard scheme?",       back: "Electrons flow once from H2O → PSII → ETC → PSI → NADP+ rather than looping back.",                     difficulty: "medium" },
    { front: "What is the Z scheme?",                                                    back: "A diagram of the energy of electrons as they pass from water through PSII, the ETC, and PSI to NADP+.", difficulty: "hard" },
    { front: "When is cyclic photophosphorylation favored?",                             back: "When the cell needs more ATP relative to NADPH; electrons cycle from PSI back into the ETC.",            difficulty: "hard" },
    { front: "Why is splitting water energetically expensive?",                          back: "It requires four sequential photoexcitations and the manganese cluster of PSII to oxidize 2 H2O.",     difficulty: "hard" },
  ],
  demoleccog01001: [
    { front: "Who developed Global Workspace Theory?",                                   back: "Bernard Baars; later extended by Stanislas Dehaene.",                                                    difficulty: "easy" },
    { front: "What does \"phi\" represent in IIT?",                                      back: "Integrated information — how much a system as a whole exceeds the sum of its parts.",                  difficulty: "easy" },
    { front: "What is a higher-order thought?",                                          back: "A thought about another mental state, used by HOT theory to explain consciousness.",                  difficulty: "easy" },
    { front: "Name three theories of consciousness.",                                    back: "Global Workspace Theory, Integrated Information Theory, Higher-Order Thought theory.",                  difficulty: "easy" },
    { front: "What metaphor does Global Workspace Theory use?",                          back: "A theatre — most processing is backstage, only the spotlight content is conscious.",                  difficulty: "medium" },
    { front: "Why is IIT difficult to test empirically?",                                back: "Phi is computationally intractable to measure exactly in real biological networks.",                    difficulty: "medium" },
    { front: "What is the primary criticism of HOT theory?",                             back: "It threatens infinite regress: a thought about a thought about a thought…",                            difficulty: "medium" },
    { front: "What does GWT predict about parallel processing?",                         back: "Most processing is unconscious and parallel; only broadcast content becomes serial conscious access.", difficulty: "medium" },
    { front: "Per IIT, can simple physical systems be conscious?",                       back: "Yes — to the extent they integrate information; this leads to controversial panpsychism-adjacent claims.", difficulty: "medium" },
    { front: "What is blindsight, and why does it matter for theories of consciousness?", back: "V1-damage patients respond to stimuli they don't report seeing — pressuring each theory's predictions.", difficulty: "hard" },
    { front: "How does GWT explain attentional limits?",                                 back: "The workspace is a serial bottleneck — only one (or few) contents can be globally broadcast at a time.", difficulty: "hard" },
    { front: "What does IIT say about a network that is feedforward only?",              back: "It has near-zero phi: feedforward systems aren't integrated, so they aren't (much) conscious by IIT.", difficulty: "hard" },
  ],
  demoleccog02002: [
    { front: "Name the three classic memory stores.",                                    back: "Sensory memory, short-term/working memory, long-term memory.",                                            difficulty: "easy" },
    { front: "What is episodic memory?",                                                 back: "Autobiographical memory of specific events tied to time and place.",                                     difficulty: "easy" },
    { front: "What is procedural memory?",                                               back: "Non-declarative memory for skills and how-to knowledge (riding a bike, typing).",                       difficulty: "easy" },
    { front: "Who plotted the original forgetting curve?",                               back: "Hermann Ebbinghaus.",                                                                                    difficulty: "easy" },
    { front: "What is the testing effect?",                                              back: "Active retrieval strengthens memory more than passive re-reading.",                                      difficulty: "medium" },
    { front: "What is retroactive interference?",                                        back: "New learning disrupts retrieval of older information.",                                                  difficulty: "medium" },
    { front: "What is proactive interference?",                                          back: "Old information disrupts the encoding or retrieval of new information.",                                difficulty: "medium" },
    { front: "Define the spacing effect.",                                               back: "Distributed practice yields better long-term retention than massed practice for the same total time.", difficulty: "medium" },
    { front: "Difference between semantic and episodic memory?",                         back: "Semantic = generic facts and concepts; episodic = specific autobiographical experiences.",             difficulty: "medium" },
    { front: "Why does retrieval failure produce tip-of-the-tongue states?",             back: "The trace is intact but the current retrieval cue doesn't activate it sufficiently.",                  difficulty: "hard" },
    { front: "Why might \"easy\" study feel productive but build weak memory?",          back: "Easy retrieval signals to the brain that the trace is strong, so consolidation effort drops.",          difficulty: "hard" },
    { front: "What is consolidation?",                                                   back: "The process by which labile memory traces are stabilized — typically via hippocampal replay during sleep.", difficulty: "hard" },
  ],
  demolecmth01001: [
    { front: "Define an eigenvector.",                                                   back: "A nonzero vector v such that A v = λ v for some scalar λ.",                                              difficulty: "easy" },
    { front: "Define an eigenvalue.",                                                    back: "The scalar λ in the equation A v = λ v.",                                                                difficulty: "easy" },
    { front: "What equation gives you the eigenvalues of A?",                            back: "The characteristic equation: det(A − λ I) = 0.",                                                         difficulty: "easy" },
    { front: "Geometrically, what does A do to its eigenvector?",                        back: "Scales it by λ without rotating — the eigenvector lies on an invariant axis.",                          difficulty: "easy" },
    { front: "When is a matrix diagonalizable?",                                         back: "When it has n linearly independent eigenvectors (equivalently, geometric multiplicity = algebraic for every eigenvalue).", difficulty: "medium" },
    { front: "What is P D P⁻¹?",                                                         back: "The diagonalization of A: D is diagonal of eigenvalues, P's columns are eigenvectors.",                  difficulty: "medium" },
    { front: "How does diagonalization help compute Aⁿ?",                                back: "Aⁿ = P Dⁿ P⁻¹, and Dⁿ raises each diagonal entry to the n.",                                              difficulty: "medium" },
    { front: "Eigenvalues of a symmetric real matrix are…?",                             back: "Always real (and the matrix has an orthonormal eigenvector basis — spectral theorem).",                difficulty: "medium" },
    { front: "Eigenvectors of distinct eigenvalues are…?",                               back: "Linearly independent.",                                                                                  difficulty: "medium" },
    { front: "What does the magnitude of eigenvalues tell you about a dynamical system?", back: "If all |λ| < 1, the system is stable (decays); if any |λ| > 1, it's unstable (grows).",                difficulty: "hard" },
    { front: "How do eigenvalues relate to PCA?",                                        back: "Principal components are eigenvectors of the data covariance matrix; eigenvalues are the variance along each.", difficulty: "hard" },
    { front: "Why can a real matrix have complex eigenvalues?",                          back: "Real coefficient polynomials can have complex roots — geometrically, this signals a rotation component.", difficulty: "hard" },
  ],
};

function buildFlashcards() {
  const out = [];
  for (const lec of LECTURES) {
    const cards = FLASHCARDS_BY_LECTURE[lec.id];
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const seq = String(i + 1).padStart(2, "0"); // "01".."12"
      // 15-char id: "demofc" (6) + 7-char-lecture-suffix + 2-digit seq.
      // lec.id ends in 8 chars after "demolec" — take the last 7.
      const lecKey = lec.id.slice(-7); // e.g. "bio01001" -> "io01001" (7)
      out.push({
        id: ("demofc" + lecKey + seq).slice(0, 15),
        lecture_id: lec.id,
        deck_name: lec.title,
        front: c.front,
        back: c.back,
        tags: [lec.course_code],
        difficulty: c.difficulty,
      });
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Quizzes — one per lecture, 8 questions each, 80 total points.
// 4 multiple_choice (10 pts), 2 true_false (10 pts), 1 short_answer (10 pts),
// 1 fill_blank (10 pts).
// ──────────────────────────────────────────────────────────────────────────

const QUIZZES = [
  {
    id: "demoqzbio010001",
    lecture_id: "demolecbio01001",
    title: "Cell Membrane Transport — Quiz",
    questions: [
      { id: "q1", type: "multiple_choice", question: "Which type of molecule passes freely through the lipid bilayer?", options: ["Glucose", "Sodium ion", "Oxygen gas", "Amino acid"],          correct_answer: 2, points: 10, difficulty: "easy",   concept_tag: "selective permeability", explanation: "Small nonpolar gases like O2 cross the hydrophobic core easily." },
      { id: "q2", type: "multiple_choice", question: "Which process requires ATP?",                                  options: ["Osmosis", "Facilitated diffusion", "Simple diffusion", "Active transport"], correct_answer: 3, points: 10, difficulty: "easy",   concept_tag: "active transport", explanation: "Only active transport pushes solutes against their gradient using energy." },
      { id: "q3", type: "multiple_choice", question: "How many ions does the Na+/K+ pump move per ATP?",            options: ["2 Na+ out, 3 K+ in", "3 Na+ out, 2 K+ in", "1 Na+ out, 1 K+ in", "3 Na+ in, 2 K+ out"], correct_answer: 1, points: 10, difficulty: "medium", concept_tag: "Na+/K+ pump", explanation: "Three sodium out, two potassium in per ATP hydrolyzed." },
      { id: "q4", type: "multiple_choice", question: "Receptor-mediated endocytosis is best described as:",          options: ["Bulk drinking of fluid", "Targeted uptake via ligand binding", "Engulfing solid particles", "Direct diffusion of small molecules"], correct_answer: 1, points: 10, difficulty: "medium", concept_tag: "endocytosis", explanation: "Ligand binding triggers clathrin-coated vesicle formation." },
      { id: "q5", type: "true_false",      question: "Osmosis is the active movement of water across a membrane.",                                                                                                                                                                                            correct_answer: false, points: 10, difficulty: "easy",   concept_tag: "osmosis", explanation: "Osmosis is passive — it requires no ATP." },
      { id: "q6", type: "true_false",      question: "Channel proteins undergo a conformational change to move solutes.",                                                                                                                                                                                       correct_answer: false, points: 10, difficulty: "medium", concept_tag: "channel vs carrier", explanation: "Carriers (not channels) undergo conformational change. Channels are open pores." },
      { id: "q7", type: "short_answer",    question: "Name the pump primarily responsible for the resting membrane potential.",                                                                                                                                                                                  correct_answer: "sodium-potassium pump", accept_also: ["Na+/K+ pump", "Na/K ATPase", "Na-K pump"], points: 10, difficulty: "medium", concept_tag: "membrane potential", explanation: "The 3:2 antiport pump establishes the gradient." },
      { id: "q8", type: "fill_blank",      question: "Bulk fluid uptake by a cell is called ____.",                                                                                                                                                                                                            correct_answer: "pinocytosis", accept_also: ["pinocytosis (cell drinking)"], points: 10, difficulty: "hard", concept_tag: "bulk transport", explanation: "Pinocytosis = cell drinking; phagocytosis = cell eating." },
    ],
  },
  {
    id: "demoqzbio020002",
    lecture_id: "demolecbio02002",
    title: "Photosynthesis Light Reactions — Quiz",
    questions: [
      { id: "q1", type: "multiple_choice", question: "Where do the light reactions occur?", options: ["Stroma", "Thylakoid membrane", "Outer chloroplast membrane", "Cytosol"], correct_answer: 1, points: 10, difficulty: "easy", concept_tag: "location", explanation: "Light reactions occur in the thylakoid membrane." },
      { id: "q2", type: "multiple_choice", question: "Photosystem II's role in the light reactions is to:", options: ["Reduce NADP+", "Split water and donate electrons", "Synthesize glucose", "Produce CO2"], correct_answer: 1, points: 10, difficulty: "easy", concept_tag: "PSII", explanation: "PSII oxidizes water, releasing O2 and electrons." },
      { id: "q3", type: "multiple_choice", question: "Atmospheric oxygen comes from:", options: ["CO2", "Glucose", "H2O", "NADPH"], correct_answer: 2, points: 10, difficulty: "medium", concept_tag: "O2 source", explanation: "PSII splits H2O — oxygen is the byproduct." },
      { id: "q4", type: "multiple_choice", question: "ATP synthase in the thylakoid is driven by:", options: ["NADPH oxidation", "A proton gradient", "Light directly", "Oxygen consumption"], correct_answer: 1, points: 10, difficulty: "medium", concept_tag: "photophosphorylation", explanation: "The proton gradient across the thylakoid powers ATP synthesis." },
      { id: "q5", type: "true_false", question: "Cyclic photophosphorylation produces both ATP and NADPH.", correct_answer: false, points: 10, difficulty: "medium", concept_tag: "cyclic flow", explanation: "Cyclic flow produces only ATP — electrons loop back without reducing NADP+." },
      { id: "q6", type: "true_false", question: "The Calvin cycle is part of the light-dependent reactions.", correct_answer: false, points: 10, difficulty: "easy", concept_tag: "scope", explanation: "Calvin cycle is light-independent and happens in the stroma." },
      { id: "q7", type: "short_answer", question: "Name the energy carrier produced by Photosystem I.", correct_answer: "NADPH", accept_also: ["nadph"], points: 10, difficulty: "medium", concept_tag: "PSI product", explanation: "PSI reduces NADP+ to NADPH." },
      { id: "q8", type: "fill_blank", question: "The diagram of light-reaction electron flow is called the ____ scheme.", correct_answer: "Z", accept_also: ["z", "Z-scheme", "z-scheme"], points: 10, difficulty: "hard", concept_tag: "Z scheme", explanation: "Named for the zigzag energy profile." },
    ],
  },
  {
    id: "demoqzcog010001",
    lecture_id: "demoleccog01001",
    title: "Theories of Consciousness — Quiz",
    questions: [
      { id: "q1", type: "multiple_choice", question: "Global Workspace Theory was originally proposed by:", options: ["Tononi", "Baars", "Rosenthal", "Block"], correct_answer: 1, points: 10, difficulty: "easy", concept_tag: "GWT origin", explanation: "Bernard Baars developed GWT; Dehaene later extended it." },
      { id: "q2", type: "multiple_choice", question: "Which theory uses phi (Φ) as a measure of consciousness?", options: ["GWT", "HOT", "IIT", "Behaviorism"], correct_answer: 2, points: 10, difficulty: "easy", concept_tag: "IIT", explanation: "IIT identifies consciousness with integrated information, phi." },
      { id: "q3", type: "multiple_choice", question: "Higher-Order Thought theory claims a state is conscious when:", options: ["It has high phi", "It is broadcast widely", "There is a thought about that state", "It involves the prefrontal cortex"], correct_answer: 2, points: 10, difficulty: "medium", concept_tag: "HOT", explanation: "HOT requires a representation about the first-order state." },
      { id: "q4", type: "multiple_choice", question: "What is the most common criticism of HOT theory?", options: ["No empirical evidence", "Infinite regress", "Inconsistent with neuroscience", "Doesn't apply to vision"], correct_answer: 1, points: 10, difficulty: "medium", concept_tag: "HOT critique", explanation: "Each thought seems to need its own thought-about-it, leading to regress." },
      { id: "q5", type: "true_false", question: "IIT predicts that simple physical systems can have a small amount of consciousness.", correct_answer: true, points: 10, difficulty: "medium", concept_tag: "IIT prediction", explanation: "Yes — any sufficiently integrated system has some phi, hence some consciousness." },
      { id: "q6", type: "true_false", question: "Global Workspace Theory claims most cognitive processing is conscious.", correct_answer: false, points: 10, difficulty: "easy", concept_tag: "GWT", explanation: "GWT is explicit that most processing is unconscious and parallel." },
      { id: "q7", type: "short_answer", question: "Name the phenomenon where V1-damaged patients respond to visual stimuli they don't consciously see.", correct_answer: "blindsight", accept_also: ["Blindsight"], points: 10, difficulty: "hard", concept_tag: "blindsight", explanation: "Classic case used to test theories of consciousness." },
      { id: "q8", type: "fill_blank", question: "GWT compares consciousness to a ____ where information is illuminated.", correct_answer: "stage", accept_also: ["theater", "theatre", "spotlight"], points: 10, difficulty: "easy", concept_tag: "GWT metaphor", explanation: "The stage / spotlight metaphor is core to GWT." },
    ],
  },
  {
    id: "demoqzcog020002",
    lecture_id: "demoleccog02002",
    title: "Memory & Forgetting — Quiz",
    questions: [
      { id: "q1", type: "multiple_choice", question: "Which is an example of procedural memory?", options: ["Recalling your phone number", "Remembering yesterday's lunch", "Riding a bike", "Knowing Paris is in France"], correct_answer: 2, points: 10, difficulty: "easy", concept_tag: "procedural memory", explanation: "Procedural memory is non-declarative motor/skill memory." },
      { id: "q2", type: "multiple_choice", question: "Episodic memory is best described as:", options: ["General world knowledge", "Specific autobiographical events", "Habits and skills", "Conditioned responses"], correct_answer: 1, points: 10, difficulty: "easy", concept_tag: "episodic", explanation: "Episodic memory is for specific events tied to time and place." },
      { id: "q3", type: "multiple_choice", question: "The testing effect implies:", options: ["Re-reading is best for retention", "Active recall outperforms re-reading", "Cramming is optimal", "Highlighting strengthens memory"], correct_answer: 1, points: 10, difficulty: "medium", concept_tag: "testing effect", explanation: "Retrieval beats passive re-exposure for long-term retention." },
      { id: "q4", type: "multiple_choice", question: "Retroactive interference is when:", options: ["Old memories disrupt new ones", "New memories disrupt old ones", "A cue fails", "Decay sets in"], correct_answer: 1, points: 10, difficulty: "medium", concept_tag: "interference", explanation: "Retroactive = newer learning disrupts older." },
      { id: "q5", type: "true_false", question: "Spaced repetition produces better long-term retention than massed practice.", correct_answer: true, points: 10, difficulty: "easy", concept_tag: "spacing effect", explanation: "The spacing effect is one of the most replicated findings in cognitive psychology." },
      { id: "q6", type: "true_false", question: "Tip-of-the-tongue states show that the memory is permanently lost.", correct_answer: false, points: 10, difficulty: "medium", concept_tag: "retrieval failure", explanation: "TOT shows the trace exists; only the current cue fails to access it." },
      { id: "q7", type: "short_answer", question: "Whose forgetting curve do we credit for the original quantitative model?", correct_answer: "Ebbinghaus", accept_also: ["Hermann Ebbinghaus", "ebbinghaus"], points: 10, difficulty: "medium", concept_tag: "Ebbinghaus", explanation: "Hermann Ebbinghaus, late 1800s — pioneering experimental memory work." },
      { id: "q8", type: "fill_blank", question: "Memory traces are stabilized during sleep through a process called ____.", correct_answer: "consolidation", accept_also: ["memory consolidation"], points: 10, difficulty: "hard", concept_tag: "consolidation", explanation: "Hippocampal replay during slow-wave sleep consolidates labile traces." },
    ],
  },
  {
    id: "demoqzmth010001",
    lecture_id: "demolecmth01001",
    title: "Eigenvalues & Eigenvectors — Quiz",
    questions: [
      { id: "q1", type: "multiple_choice", question: "If A v = 5 v with v ≠ 0, then 5 is called the:", options: ["Eigenvector", "Eigenvalue", "Determinant", "Trace"], correct_answer: 1, points: 10, difficulty: "easy", concept_tag: "definition", explanation: "λ = 5 is the eigenvalue corresponding to eigenvector v." },
      { id: "q2", type: "multiple_choice", question: "The eigenvalues of A are the roots of:", options: ["det(A) = 0", "tr(A) = 0", "det(A − λ I) = 0", "A v = 0"], correct_answer: 2, points: 10, difficulty: "easy", concept_tag: "characteristic eq", explanation: "Solve det(A − λI) = 0 for λ." },
      { id: "q3", type: "multiple_choice", question: "A real symmetric matrix always has:", options: ["Complex eigenvalues", "A zero eigenvalue", "Real eigenvalues and orthogonal eigenvectors", "Determinant 1"], correct_answer: 2, points: 10, difficulty: "medium", concept_tag: "spectral theorem", explanation: "Spectral theorem: real symmetric ⇒ real eigenvalues + orthonormal eigenvector basis." },
      { id: "q4", type: "multiple_choice", question: "If A = P D P⁻¹, then Aⁿ equals:", options: ["P D P⁻ⁿ", "Pⁿ D P⁻¹", "P Dⁿ P⁻¹", "(P D)ⁿ"], correct_answer: 2, points: 10, difficulty: "medium", concept_tag: "diagonalization", explanation: "Aⁿ = P Dⁿ P⁻¹ — extremely useful for computing matrix powers." },
      { id: "q5", type: "true_false", question: "Eigenvectors of distinct eigenvalues are linearly independent.", correct_answer: true, points: 10, difficulty: "medium", concept_tag: "independence", explanation: "Standard result — proven by induction on the number of eigenvectors." },
      { id: "q6", type: "true_false", question: "Every square matrix is diagonalizable.", correct_answer: false, points: 10, difficulty: "medium", concept_tag: "diagonalizable", explanation: "Defective matrices (e.g., a Jordan block with size > 1) are not diagonalizable." },
      { id: "q7", type: "short_answer", question: "What does the magnitude of the largest eigenvalue tell you about a discrete linear dynamical system?", correct_answer: "stability", accept_also: ["whether it is stable", "stable or unstable", "growth rate"], points: 10, difficulty: "hard", concept_tag: "stability", explanation: "If max |λ| < 1 it's stable; > 1 unstable." },
      { id: "q8", type: "fill_blank", question: "Principal Component Analysis finds the eigenvectors of the ____ matrix.", correct_answer: "covariance", accept_also: ["data covariance", "sample covariance"], points: 10, difficulty: "hard", concept_tag: "PCA", explanation: "PCA decomposes the covariance matrix; eigenvalues are the variances along each component." },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Study sessions — 5 days, one per day, today minus 0..4. duration_secs=1200
// each, 15 cards reviewed, 12 correct. session_type=flashcard_review,
// lecture = first lecture id (BIO 201 — Cell Membrane Transport).
// ──────────────────────────────────────────────────────────────────────────

const STUDY_SESSIONS = [
  { id: "demosess0000000", lecture_id: LECTURES[0].id, days_ago: 0, duration_secs: 1200, cards_reviewed: 15, cards_correct: 12 },
  { id: "demosess0000001", lecture_id: LECTURES[0].id, days_ago: 1, duration_secs: 1200, cards_reviewed: 15, cards_correct: 12 },
  { id: "demosess0000002", lecture_id: LECTURES[0].id, days_ago: 2, duration_secs: 1200, cards_reviewed: 15, cards_correct: 12 },
  { id: "demosess0000003", lecture_id: LECTURES[0].id, days_ago: 3, duration_secs: 1200, cards_reviewed: 15, cards_correct: 12 },
  { id: "demosess0000004", lecture_id: LECTURES[0].id, days_ago: 4, duration_secs: 1200, cards_reviewed: 15, cards_correct: 12 },
];

// ──────────────────────────────────────────────────────────────────────────
// Top-level dataset.
// ──────────────────────────────────────────────────────────────────────────

const demoData = {
  user: {
    id: USER_ID,
    email: "demo@hackstack.dev",
    password: "demohackstack",
    display_name: "Demo Student",
    onboarding_done: true,
    badges: [
      {
        label: "Administrator",
        backgroundColor: "#42a36e",
        textColor: "#ffffff",
        borderColor: "transparent",
      },
    ],
  },
  courses: [
    { id: COURSE_IDS.bio, name: "Biology 201",                code: "BIO 201",  semester: "Spring 2026", color: "#14b8a6" },
    { id: COURSE_IDS.cog, name: "Intro to Cognitive Science", code: "COGS 101", semester: "Spring 2026", color: "#6366f1" },
    { id: COURSE_IDS.mth, name: "Linear Algebra",             code: "MATH 1B",  semester: "Spring 2026", color: "#ec4899" },
  ],
  lectures: LECTURES.map((l) => ({
    id: l.id,
    course_id: l.course_id,
    title: l.title,
    duration_secs: l.duration_secs,
    days_ago: l.days_ago,
  })),
  transcripts: buildTranscripts(),
  notes: NOTES,
  flashcards: buildFlashcards(),
  quizzes: QUIZZES.map((q) => ({
    id: q.id,
    lecture_id: q.lecture_id,
    title: q.title,
    questions: q.questions,
    total_points: q.questions.reduce((sum, x) => sum + (x.points || 0), 0),
  })),
  study_sessions: STUDY_SESSIONS,
};

// Dual-export so this works under both PocketBase's JSVM (CommonJS) and
// modern ESM Node (frontend/scripts/seed.ts via dynamic import).
module.exports = demoData;
module.exports.demoData = demoData;
module.exports.default = demoData;
