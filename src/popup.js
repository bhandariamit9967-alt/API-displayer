
const FEEDBACK_DB = {
  logo: {
    label: "Logo Size",
    nitpick: [
      "The logo feels a tad small, can we nudge it up just a smidge?",
      "Just a thought—could the logo breathe a little more? Maybe 10% bigger?",
      "My business card has the logo bigger than this. Food for thought.",
    ],
    change: [
      "Can you make the logo bigger? Like, noticeably bigger. People need to SEE it.",
      "The logo needs to be the hero here. Can we try 2x the current size?",
      "Honestly I think the logo should be the first thing people see, way bigger.",
    ],
    panic: [
      "WHY IS THE LOGO SO SMALL? The CEO is going to lose it. Please fix ASAP.",
      "The logo is practically invisible. This cannot go to launch like this. BIGGER. NOW.",
      "I showed this to my boss and the first thing he said was 'where's our logo?' Please.",
    ]
  },
  color: {
    label: "Color",
    nitpick: [
      "What if we tried the button in a slightly warmer blue? This one feels cold.",
      "The background feels a tad gray—can we warm it up just a touch?",
      "Could we try the headline in our exact brand blue? Not sure this is matching.",
    ],
    change: [
      "What if we tried it in blue? Our competitors use blue and it really pops.",
      "The whole color palette feels off. Can we revisit? I'm thinking more purple.",
      "We need this to feel more vibrant. More orange maybe? Or green? Let's explore.",
    ],
    panic: [
      "That red is NOT our red. Our red is #C41E3A not whatever this is. Please fix immediately.",
      "My wife thinks the colors look depressing. She has great taste. Start over.",
      "Legal just flagged that the blue we're using is trademarked by [Competitor]. Emergency.",
    ]
  },
  copy: {
    label: "Copy",
    nitpick: [
      "The headline is a bit long. Can we trim it to maybe 4 words?",
      "Subheadline feels a bit corporate-y. Can we make it more 'human'?",
      "The CTA button copy feels weak. 'Learn More' isn't very exciting.",
    ],
    change: [
      "Can you change all the copy? My cousin wrote something better. I'll send it over.",
      "The tagline isn't landing. We need something more 'disruptive' and 'synergistic'.",
      "Can we add our full mission statement in the hero? All 4 paragraphs of it.",
    ],
    panic: [
      "WE SPELLED THE COMPANY NAME WRONG ON EVERY SLIDE. How did this happen.",
      "Legal says we can't use the word 'innovative' anymore. Please find and replace. All 47 instances.",
      "The CEO just rewrote all the copy. I'm sending 600 sticky notes. Can you implement tonight?",
    ]
  },
  layout: {
    label: "Layout",
    nitpick: [
      "This element feels a pixel or two off-center. Can you double-check the alignment?",
      "The cards feel slightly too close together. A little more breathing room?",
      "The header and footer feel unbalanced. Maybe match their heights?",
    ],
    change: [
      "Can we move the sidebar to the right? I always read left-to-right on websites.",
      "The whole layout feels too 'boxy'. Can we try something more dynamic? Diagonal maybe?",
      "My gut says the CTA should be at the very top. Like before the headline.",
    ],
    panic: [
      "My old website had a completely different layout and our sales were higher. Please replicate it.",
      "The CEO has printed this out and drawn arrows everywhere. Photo incoming.",
      "We showed this to a focus group of one (my husband) and he was confused. Completely redo layout.",
    ]
  },
  whitespace: {
    label: "Whitespace",
    nitpick: [
      "There's a lot of blank space here. Could we fill it with something?",
      "The top section feels a bit sparse. Can we add more content up there?",
      "Feels like we're not using the full width. Is that intentional?",
    ],
    change: [
      "All this empty space feels like we didn't finish the design. Fill it with our awards maybe?",
      "Can we squeeze more content above the fold? Whitespace is wasted real estate.",
      "Let's add a ticker tape of our clients' logos across the middle. And some testimonials.",
    ],
    panic: [
      "I'm being told we're paying per pixel so CAN WE PLEASE use all the space.",
      "My previous agency would have filled all this empty space. Are you sure you're done?",
      "Just add something. Anything. A stock photo. Some bullets. It looks empty.",
    ]
  },
  branding: {
    label: "Branding",
    nitpick: [
      "The font doesn't quite feel like 'us'. Can you check our brand guide?",
      "Is this the right shade of our green? Feels slightly off to me.",
      "The icon style doesn't feel consistent with what we've used before.",
    ],
    change: [
      "We updated our branding last week. The new logo has a gradient. I'll send it... soon.",
      "This doesn't feel very 'on-brand'. It's hard to explain. Just more... us.",
      "Can we add the 'As Featured In Forbes' badge? It expired but it still counts right?",
    ],
    panic: [
      "We just rebranded. Yesterday. New name, new logo, new everything. Can you update the designs?",
      "The brand guide I sent you was the OLD brand guide. I'm sorry. Starting over.",
      "Our branding consultant says none of this matches what she created. Please call her. Here's her number.",
    ]
  },
  nephew: {
    label: "My Nephew",
    nitpick: [
      "My nephew does graphic design and he might have some thoughts. Can I loop him in?",
      "I showed my nephew and he said the font looks a bit 'dated'. He's 14 so he knows.",
      "My nephew could probably whip something up too, but this is good. Just saying.",
    ],
    change: [
      "My nephew made a mockup in PowerPoint. Can you just recreate what he did?",
      "My nephew says real designers use Adobe Illustrator, not Figma. Just FYI.",
      "My nephew says this could be done in Canva. Is there a reason we're not using Canva?",
    ],
    panic: [
      "My nephew could do this for $50. Just putting that out there.",
      "I'm going to have my nephew take a crack at this over the weekend. We'll compare Monday.",
      "My nephew just sent me a redesign at 11pm. Honestly? Kind of into it. Sending now.",
    ]
  },
  competitor: {
    label: "Competitor",
    nitpick: [
      "Apple's website doesn't have this many elements on one page. Something to consider.",
      "I noticed Airbnb uses a lot more photography. Maybe we should too?",
      "Notion's UI feels very clean. Can we feel more Notion-y?",
    ],
    change: [
      "Can we just make it look more like our competitors? Their site converts really well.",
      "Google doesn't use drop shadows. Should we? I feel like we should.",
      "Stripe has a very particular look. Can we aim for 'budget Stripe'?",
    ],
    panic: [
      "Our competitor just launched a redesign this morning. Everything we're doing is now wrong.",
      "I want to show this side-by-side with [Competitor]'s homepage. Currently losing. Please fix.",
      "The competitor launched while we were in revision round 7. We need to beat them by Monday.",
    ]
  },
  scope: {
    label: "Scope Creep",
    nitpick: [
      "While we're at it, could we also do a dark mode version? Shouldn't be too much extra work.",
      "Just a quick thing—can we also design the email templates? Same style as this.",
      "Since you're in there anyway, could you add an animated loading state?",
    ],
    change: [
      "We just decided we also need an app version. iPhone and Android. Same timeline.",
      "Can you add a full e-commerce flow? We decided we're selling products now.",
      "We want to add a blog, a podcast player, a member area, and a job board. How long?",
    ],
    panic: [
      "We're presenting to investors in 4 hours. Can you add an interactive demo, a pricing page, and a pitch deck?",
      "Change of plans: we're now a SaaS company. Please redesign accordingly. By tomorrow.",
      "The whole product pivot happened over the weekend. We're now B2B. Can you shift everything?",
    ]
  },
  font: {
    label: "Fonts",
    nitpick: [
      "Is that font licensed? Our lawyer is asking. Can you double-check?",
      "The body text might be a touch small for older users. Can we bump it up 1px?",
      "The quote marks in the testimonials look a bit weird. Are those the right ones?",
    ],
    change: [
      "Can we use Comic Sans for the casual, friendly sections? I love Comic Sans.",
      "The font feels too 'digital'. Can we find something more hand-written and human?",
      "My wife likes Papyrus. Can we try a section in Papyrus? Just to see.",
    ],
    panic: [
      "We just found out the font we're using costs $400/year per user. Change everything.",
      "The font renders terribly on Windows. We tested it on a Windows machine for the first time.",
      "Our CEO just trademarked a custom font he designed. I'm attaching a photo of his handwriting.",
    ]
  },
  mobile: {
    label: "Mobile",
    nitpick: [
      "Does this work on mobile? I tried opening it on my phone and it looked... different.",
      "The tap targets on mobile might be a bit small. My fingers are big.",
      "Mobile loads a little slow on my carrier. Can you make it faster?",
    ],
    change: [
      "Can you add a separate mobile design? Same content but completely different layout.",
      "We need this to look exactly the same on desktop, tablet, mobile, and watch.",
      "The mobile menu is confusing. Can you add a tutorial overlay explaining how hamburger menus work?",
    ],
    panic: [
      "Our CEO checked it on his phone and it was broken. He only uses a 2014 iPhone 5c.",
      "60% of our traffic is mobile and this wasn't designed for mobile AT ALL. Emergency.",
      "The client tested on IE11 on a Surface Pro and is threatening to cancel. Please help.",
    ]
  },
  vibe: {
    label: "Vibes",
    nitpick: [
      "Something feels slightly off but I can't put my finger on it. Can you just... try something?",
      "It doesn't quite feel like us yet. More energy maybe? Or less?",
      "I showed my team and we all agreed something is slightly... not right.",
    ],
    change: [
      "It's too clean. It needs to feel messier, like a real human made it.",
      "It's too messy. Can you clean it up to feel more professional?",
      "The vibe is 'corporate'. We want 'scrappy startup that also feels enterprise'. Does that make sense?",
    ],
    panic: [
      "My gut says this is all wrong. I can't explain it but I know it's wrong. Please just redo it.",
      "We showed this to our advisory board and they said it doesn't 'inspire confidence'. Burn it down.",
      "I had a dream about the website last night and it was different. Let me describe the dream.",
    ]
  }
};

const SEVERITY_EMOJI = { nitpick: '🟡', change: '🔵', panic: '🔴' };

let comments = [];
let selectedCount = 5;


chrome.storage.local.get(['figmaroast_comments'], (result) => {
  if (result.figmaroast_comments) {
    comments = result.figmaroast_comments;
    updateUI();
  }
});

function saveState() {
  chrome.storage.local.set({ figmaroast_comments: comments });
}

function updateUI() {
  const total = comments.length;
  const open = comments.filter(c => !c.resolved && !c.dismissed).length;
  const resolved = comments.filter(c => c.resolved).length;

  document.getElementById('totalCount').textContent = total;
  document.getElementById('openCount').textContent = open;
  document.getElementById('resolvedCount').textContent = resolved;

  const section = document.getElementById('commentsSection');
  const list = document.getElementById('commentsList');

  const visible = comments.filter(c => !c.dismissed);

  if (visible.length > 0) {
    section.style.display = 'block';
    list.innerHTML = '';
    visible.forEach(c => {
      list.appendChild(buildCommentCard(c));
    });
  } else {
    section.style.display = 'none';
  }
}

function buildCommentCard(comment) {
  const div = document.createElement('div');
  div.className = `comment-card ${comment.resolved ? 'resolved' : ''}`;
  div.dataset.id = comment.id;

  const catInfo = FEEDBACK_DB[comment.category];
  const badge = comment.resolved
    ? `<span class="comment-sev resolved-badge">✓ Resolved</span>`
    : `<span class="comment-sev ${comment.severity}">${SEVERITY_EMOJI[comment.severity]} ${comment.severity}</span>`;

  div.innerHTML = `
    <div class="comment-header">
      ${badge}
      <span class="comment-cat">${catInfo?.label || comment.category}</span>
    </div>
    <div class="comment-text">${comment.text}</div>
    <div class="comment-actions">
      ${!comment.resolved ? `<button class="comment-btn resolve" data-action="resolve" data-id="${comment.id}">✓ Mark Addressed</button>` : ''}
      <button class="comment-btn dismiss" data-action="dismiss" data-id="${comment.id}">✕ Dismiss</button>
    </div>
  `;

  div.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', handleCommentAction);
  });

  return div;
}

function handleCommentAction(e) {
  const action = e.target.dataset.action;
  const id = e.target.dataset.id;
  const idx = comments.findIndex(c => c.id === id);
  if (idx === -1) return;

  if (action === 'resolve') {
    comments[idx].resolved = true;
    // Also send message to content script to update on canvas
    sendToContent({ action: 'updateComment', id, state: 'resolved' });
  } else if (action === 'dismiss') {
    comments[idx].dismissed = true;
    sendToContent({ action: 'updateComment', id, state: 'dismissed' });
  }

  saveState();
  updateUI();
}


document.querySelectorAll('.cat-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('active');
  });
});


document.querySelectorAll('.count-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedCount = parseInt(btn.dataset.count);
    document.getElementById('customCount').value = '';
  });
});

document.getElementById('customCount').addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  if (val > 0 && val <= 50) {
    selectedCount = val;
    document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
  }
});


function updateSlider(sliderId, pctId, color) {
  const slider = document.getElementById(sliderId);
  const pct = document.getElementById(pctId);
  slider.addEventListener('input', () => {
    pct.textContent = slider.value + '%';
    const val = slider.value;
    slider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${val}%, var(--border) ${val}%)`;
  });
}

updateSlider('nitpickSlider', 'nitpickPct', '#F59E0B');
updateSlider('changeSlider', 'changePct', '#3B82F6');
updateSlider('panicSlider', 'panicPct', '#EF4444');


document.getElementById('generateBtn').addEventListener('click', async () => {
  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  btn.querySelector('.btn-text').textContent = 'Injecting chaos...';

  const activeCategories = [...document.querySelectorAll('.cat-chip.active')]
    .map(c => c.querySelector('input').value);

  if (activeCategories.length === 0) {
    alert('Please select at least one feedback category.');
    btn.disabled = false;
    btn.querySelector('.btn-text').textContent = 'Generate Client Feedback';
    return;
  }

  const nitpickW = parseInt(document.getElementById('nitpickSlider').value);
  const changeW = parseInt(document.getElementById('changeSlider').value);
  const panicW = parseInt(document.getElementById('panicSlider').value);
  const total = nitpickW + changeW + panicW || 1;

  const newComments = [];

  for (let i = 0; i < selectedCount; i++) {
    const cat = activeCategories[Math.floor(Math.random() * activeCategories.length)];
    const rand = Math.random() * total;
    let severity;
    if (rand < nitpickW) severity = 'nitpick';
    else if (rand < nitpickW + changeW) severity = 'change';
    else severity = 'panic';

    const pool = FEEDBACK_DB[cat]?.[severity] || FEEDBACK_DB[cat]?.change || [];
    const text = pool[Math.floor(Math.random() * pool.length)] || 'Please review this.';

    const comment = {
      id: `fr_${Date.now()}_${i}`,
      category: cat,
      severity,
      text,
      resolved: false,
      dismissed: false,
      timestamp: Date.now() + i
    };
    newComments.push(comment);
    comments.push(comment);
  }

  saveState();


  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, {
      action: 'injectComments',
      comments: newComments
    });
    document.getElementById('statusText').textContent = 'Injected!';
    setTimeout(() => { document.getElementById('statusText').textContent = 'Ready'; }, 2000);
  } catch (e) {
    document.getElementById('statusText').textContent = 'Open Figma first';
    setTimeout(() => { document.getElementById('statusText').textContent = 'Ready'; }, 3000);
  }

  updateUI();
  btn.disabled = false;
  btn.querySelector('.btn-text').textContent = 'Generate Client Feedback';
});


document.getElementById('resolveAllBtn').addEventListener('click', () => {
  comments.forEach(c => { if (!c.dismissed) c.resolved = true; });
  saveState();
  sendToContent({ action: 'resolveAll' });
  updateUI();
});


document.getElementById('clearAllBtn').addEventListener('click', () => {
  comments = [];
  saveState();
  sendToContent({ action: 'clearAll' });
  updateUI();
});

async function sendToContent(msg) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, msg);
  } catch (e) { /* not on figma */ }
}

updateUI();

