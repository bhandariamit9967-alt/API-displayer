const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const thesisInput = document.getElementById('thesisInput');
const searchBtn = document.getElementById('searchBtn');
const status = document.getElementById('status');
const resultsWrapper = document.getElementById('resultsWrapper');

let vaultFiles = [];

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('hover');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('hover'));

dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('hover');
    vaultFiles = [];
    status.innerText = "Reading directory tree structure...";

    const items = e.dataTransfer.items;
    for (let item of items) {
        if (item.kind === 'file') {
            if (typeof item.getAsFileSystemHandle === 'function') {
                const handle = await item.getAsFileSystemHandle();
                if (handle) await traverseFileSystemHandle(handle);
            } else {
                const entry = item.webkitGetAsEntry();
                if (entry) await readWebkitEntry(entry);
            }
        }
    }
    updateFolderUIState();
});

fileInput.addEventListener('change', async (e) => {
    vaultFiles = [];
    status.innerText = "Parsing selected files...";
    const files = e.target.files;
    for (let file of files) {
        if (file.name.endsWith('.md')) {
            const text = await file.text();
            vaultFiles.push({ name: file.name, content: text });
        }
    }
    updateFolderUIState();
});

async function traverseFileSystemHandle(handle) {
    if (handle.kind === 'file' && handle.name.endsWith('.md')) {
        const file = await handle.getFile();
        const text = await file.text();
        vaultFiles.push({ name: handle.name, content: text });
    } else if (handle.kind === 'directory') {
        for await (const entry of handle.values()) {
            await traverseFileSystemHandle(entry);
        }
    }
}

async function readWebkitEntry(entry) {
    if (entry.isFile && entry.name.endsWith('.md')) {
        const file = await new Promise(resolve => entry.file(resolve));
        const text = await file.text();
        vaultFiles.push({ name: entry.name, content: text });
    } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const entries = await new Promise(resolve => reader.readEntries(resolve));
        for (let subEntry of entries) {
            await readWebkitEntry(subEntry);
        }
    }
}

function updateFolderUIState() {
    if (vaultFiles.length > 0) {
        dropZone.classList.add('loaded');
        dropZone.innerText = "Connected!";
        status.innerHTML = `Loaded <strong>${vaultFiles.length}</strong> markdown notes.`;
    } else {
        status.innerText = "No .md files found in folder.";
    }
}

searchBtn.addEventListener('click', () => {
    const thesis = thesisInput.value.trim();
    if (!thesis) return alert('Please enter a thesis statement.');
    if (vaultFiles.length === 0) return alert('Please load your notes folder first.');

    resultsWrapper.innerHTML = '';

    const thesisCard = document.createElement('div');
    thesisCard.className = 'thesis-card';
    thesisCard.innerHTML = `<h4>Thesis Core</h4><p>"${thesis}"</p>`;
    resultsWrapper.appendChild(thesisCard);

    const matches = [];
    const contradictionWords = ['however', 'but', 'disagree', 'instead', 'on the other hand', 'alternatively', 'flaw', 'false', 'contradict', 'contrarily', 'nevertheless', 'oppose'];
    const thesisWords = thesis.toLowerCase().match(/\b\w{4,}\b/g) || [];

    for (let file of vaultFiles) {
        const paragraphs = file.content.split(/\n{2,}/);

        for (let paragraph of paragraphs) {
            const cleanPara = paragraph.trim();
            if (cleanPara.length < 15) continue;

            const paraLower = cleanPara.toLowerCase();
            let overlapCount = 0;
            let hasContradictionWord = false;

            for (let word of thesisWords) {
                if (paraLower.includes(word)) overlapCount++;
            }

            for (let trigger of contradictionWords) {
                if (paraLower.includes(trigger)) {
                    hasContradictionWord = true;
                    break;
                }
            }

            if (overlapCount >= 1 && hasContradictionWord) {
                matches.push({ text: cleanPara, fileName: file.name });
            }
            if (matches.length >= 4) break;
        }
        if (matches.length >= 4) break;
    }

    if (matches.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.style.color = 'var(--text-muted)';
        emptyMsg.style.fontSize = '0.85rem';
        emptyMsg.style.textAlign = 'center';
        emptyMsg.innerText = "No contradictions found across your loaded notes.";
        resultsWrapper.appendChild(emptyMsg);
        return;
    }

    const listTitle = document.createElement('div');
    listTitle.className = 'results-header';
    listTitle.innerText = "Counterarguments:";
    resultsWrapper.appendChild(listTitle);

    matches.forEach((match, index) => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.style.animationDelay = `${index * 60}ms`;
        card.innerHTML = `<p>${match.text}</p><div class="card-footer">Source: ${match.fileName}</div>`;
        resultsWrapper.appendChild(card);
    });
});