// ===================== CONFIGURAÇÃO =====================
let uploadedTracks = [];   // { name, duration, file, url, customName?, id, handle? }
let albumData = {
    name: '',
    cover: '',
    type: '',
    duration: 0,
    trackCount: 0
};
let trackIdCounter = Date.now();

// ===================== INICIALIZAÇÃO =====================
document.addEventListener('DOMContentLoaded', async () => {
    await restoreSessionIfPossible();
    setupEventListeners();
    // Exibe o álbum se já houver dados restaurados
    if (uploadedTracks.length > 0) {
        displayAlbum();
    }
});

// ===================== EVENT LISTENERS =====================
function setupEventListeners() {
    const uploadArea = document.getElementById('uploadArea');
    const musicFiles = document.getElementById('musicFiles');

    // Drag and drop para upload de arquivos
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);

    // File input change
    if (musicFiles) {
        musicFiles.addEventListener('change', handleFileSelect);
    }

    // Clique na área (fallback para abrir input)
    uploadArea.addEventListener('click', (e) => {
        // Se o clique foi no botão, não faz nada (o botão tem seu próprio listener)
        if (e.target.closest('#selectFilesBtn')) return;
        if (musicFiles) musicFiles.click();
    });

    // Configura o botão principal (caso ele já exista no HTML)
    const selectFilesBtn = document.getElementById('selectFilesBtn');
    if (selectFilesBtn) {
        selectFilesBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await handleSelectButtonClick();
        });
    }

    // Drag and drop na tracklist (reordenação)
    setupTracklistDragAndDrop();
}

// Ação do botão "Selecionar Arquivos"
async function handleSelectButtonClick() {
    const musicFiles = document.getElementById('musicFiles');
    if (window.showOpenFilePicker) {
        try {
            await selectFilesWithPicker();
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error(err);
                alert('Erro ao selecionar arquivos. Tente novamente.');
            }
        }
    } else {
        if (musicFiles) musicFiles.click();
    }
}

// ===================== SELEÇÃO VIA API MODERNA =====================
async function selectFilesWithPicker() {
    const uploadArea = document.getElementById('uploadArea');
    // Feedback visual
    const originalHTML = uploadArea.innerHTML;
    uploadArea.innerHTML = `<div class="loading"></div><h3>Abrindo seletor...</h3><p>Escolha seus arquivos de áudio</p>`;

    let handles;
    try {
        handles = await window.showOpenFilePicker({
            types: [{
                description: 'Arquivos de Áudio',
                accept: { 'audio/*': ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'] }
            }],
            multiple: true,
        });
    } catch (err) {
        uploadArea.innerHTML = originalHTML; // restaura se cancelar
        throw err;
    }

    uploadArea.innerHTML = `<div class="loading"></div><h3>Processando ${handles.length} arquivo(s)...</h3>`;

    const newTracks = [];
    for (const handle of handles) {
        const file = await handle.getFile();
        const url = URL.createObjectURL(file);
        const duration = await getAudioDuration(url);
        newTracks.push({
            name: file.name.replace(/\.[^/.]+$/, ""),
            customName: null,
            duration,
            file,
            url,
            handle,
            id: trackIdCounter++
        });
    }

    addTracks(newTracks);
    resetUploadArea(); // retorna ao visual normal
}

// ===================== UPLOAD VIA INPUT COMUM =====================
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    processFiles(files);
    e.target.value = ''; // limpa para permitir selecionar os mesmos arquivos novamente
}

async function processFiles(files) {
    if (files.length === 0) return;
    
    // Confirmação se já existem faixas
    if (uploadedTracks.length > 0) {
        const replace = confirm(
            `Você já tem ${uploadedTracks.length} faixa(s). Deseja SUBSTITUIR todas pelas novas?\n\nOK = Substituir\nCancelar = Adicionar às atuais`
        );
        if (replace) {
            clearAllTracksSilently();
        }
    }

    showProgress(0, files.length);
    
    const newTracks = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = URL.createObjectURL(file);
        const duration = await getAudioDuration(url);
        newTracks.push({
            name: file.name.replace(/\.[^/.]+$/, ""),
            customName: null,
            duration,
            file,
            url,
            handle: null,
            id: trackIdCounter++
        });
        showProgress(i + 1, files.length);
    }

    uploadedTracks = uploadedTracks.concat(newTracks);
    saveSessionMetadata();
    displayAlbum();
    resetUploadArea();
}

function addTracks(newTracks) {
    // Confirmação se já existem faixas (usado pela API moderna)
    if (uploadedTracks.length > 0) {
        const replace = confirm(
            `Você já tem ${uploadedTracks.length} faixa(s). Deseja SUBSTITUIR todas pelas novas?\n\nOK = Substituir\nCancelar = Adicionar às atuais`
        );
        if (replace) {
            clearAllTracksSilently();
        }
    }
    uploadedTracks = uploadedTracks.concat(newTracks);
    saveSessionMetadata();
    storeHandlesIfAvailable();
    displayAlbum();
}

// ===================== DURAÇÃO DO ÁUDIO =====================
function getAudioDuration(url) {
    return new Promise((resolve) => {
        const audio = new Audio();
        audio.addEventListener('loadedmetadata', () => {
            resolve(audio.duration);
        });
        audio.addEventListener('error', () => {
            resolve(0); // fallback
        });
        audio.src = url;
    });
}

// ===================== EXIBIÇÃO DO ÁLBUM =====================
function displayAlbum() {
    const albumSection = document.getElementById('albumSection');
    const albumName = document.getElementById('albumName');
    const albumType = document.getElementById('albumType');
    const albumDuration = document.getElementById('albumDuration');
    const trackCount = document.getElementById('trackCount');
    const tracklist = document.getElementById('tracklist');

    const totalDuration = uploadedTracks.reduce((sum, t) => sum + t.duration, 0);
    albumData = {
        name: albumData.name || 'Meu Álbum',
        cover: albumData.cover || '',
        type: classifyAlbum(uploadedTracks.length),
        duration: totalDuration,
        trackCount: uploadedTracks.length
    };

    albumName.value = albumData.name;
    albumType.textContent = albumData.type;
    albumDuration.textContent = formatDuration(totalDuration);
    trackCount.textContent = `${uploadedTracks.length} faixa${uploadedTracks.length !== 1 ? 's' : ''}`;

    tracklist.innerHTML = '';
    uploadedTracks.forEach((track, index) => {
        const el = createTrackElement(track, index + 1);
        tracklist.appendChild(el);
    });

    // Adiciona controles de ordenação somente se existirem faixas
    addSortControls();

    albumSection.style.display = 'block';
    albumSection.classList.add('fade-in');
}

function createTrackElement(track, trackNumber) {
    const trackEl = document.createElement('div');
    trackEl.className = 'track';
    trackEl.draggable = true;
    trackEl.dataset.id = track.id;

    const displayName = track.customName || track.name;
    trackEl.innerHTML = `
        <span class="drag-handle" title="Arraste para reordenar"><i class="fas fa-grip-vertical"></i></span>
        <div class="track-number">${trackNumber}</div>
        <div class="track-info">
            <div class="track-name" data-id="${track.id}" title="Duplo clique para editar">${displayName}</div>
            <div class="track-duration">${formatDuration(track.duration)}</div>
        </div>
    `;

    // Edição inline com duplo clique
    const nameDiv = trackEl.querySelector('.track-name');
    nameDiv.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        makeEditable(nameDiv, track);
    });

    // Drag events
    trackEl.addEventListener('dragstart', handleTrackDragStart);
    trackEl.addEventListener('dragend', handleTrackDragEnd);

    return trackEl;
}

function makeEditable(div, track) {
    const currentName = div.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'track-name-input';
    input.addEventListener('blur', () => finishEdit(input, div, track));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finishEdit(input, div, track);
        if (e.key === 'Escape') {
            div.textContent = currentName;
            input.replaceWith(div);
        }
    });
    div.replaceWith(input);
    input.focus();
    input.select();
}

function finishEdit(input, div, track) {
    const newName = input.value.trim() || track.name;
    track.customName = newName;
    div.textContent = newName;
    input.replaceWith(div);
    saveSessionMetadata();
}

// ===================== ORDENAÇÃO =====================
function sortTracks(criteria = 'name') {
    if (criteria === 'duration') {
        uploadedTracks.sort((a, b) => b.duration - a.duration);
    } else {
        uploadedTracks.sort((a, b) => (a.customName || a.name).localeCompare(b.customName || b.name));
    }
    saveSessionMetadata();
    refreshTracklistDisplay();
    // Reaplica os números
    refreshTrackNumbers();
}

function addSortControls() {
    // Remove controles antigos se existirem
    const oldControls = document.querySelector('.sort-controls');
    if (oldControls) oldControls.remove();

    if (uploadedTracks.length < 2) return;

    const tracklistSection = document.querySelector('.tracklist-section h3');
    if (!tracklistSection) return;

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'sort-controls';
    controlsDiv.innerHTML = `
        <button class="sort-btn" id="sortByName"><i class="fas fa-sort-alpha-down"></i> Nome</button>
        <button class="sort-btn" id="sortByDuration"><i class="fas fa-clock"></i> Duração</button>
    `;
    tracklistSection.parentNode.insertBefore(controlsDiv, tracklistSection.nextSibling);

    document.getElementById('sortByName').addEventListener('click', () => sortTracks('name'));
    document.getElementById('sortByDuration').addEventListener('click', () => sortTracks('duration'));
}

// ===================== DRAG AND DROP DA TRACKLIST =====================
function setupTracklistDragAndDrop() {
    const tracklist = document.getElementById('tracklist');
    tracklist.addEventListener('dragover', handleTracklistDragOver);
    tracklist.addEventListener('drop', handleTracklistDrop);
}

let draggedItem = null;

function handleTrackDragStart(e) {
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.id);
}

function handleTrackDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.track.drop-zone').forEach(el => el.classList.remove('drop-zone'));
    draggedItem = null;
}

function handleTracklistDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.target.closest('.track');
    if (!target || target === draggedItem) return;

    const rect = target.getBoundingClientRect();
    const mid = (rect.bottom - rect.top) / 2;
    const after = e.clientY - rect.top > mid;

    document.querySelectorAll('.track.drop-zone').forEach(el => el.classList.remove('drop-zone'));
    if (after) {
        target.classList.add('drop-zone');
    } else {
        const prev = target.previousElementSibling;
        if (prev && prev.classList.contains('track')) {
            prev.classList.add('drop-zone');
        } else {
            target.classList.add('drop-zone');
        }
    }
    e.dataTransfer.dropAfter = after;
}

function handleTracklistDrop(e) {
    e.preventDefault();
    const target = e.target.closest('.track');
    if (!target || !draggedItem || target === draggedItem) return;

    const dropAfter = e.dataTransfer.dropAfter;
    const fromId = draggedItem.dataset.id;
    const toId = target.dataset.id;

    const fromIndex = uploadedTracks.findIndex(t => t.id == fromId);
    let toIndex = uploadedTracks.findIndex(t => t.id == toId);
    if (fromIndex === -1 || toIndex === -1) return;

    // Remove o item da posição original
    const [movedTrack] = uploadedTracks.splice(fromIndex, 1);
    // Recalcula toIndex após a remoção
    toIndex = uploadedTracks.findIndex(t => t.id == toId);
    if (dropAfter) {
        toIndex = toIndex + 1;
    }
    uploadedTracks.splice(toIndex, 0, movedTrack);

    saveSessionMetadata();
    refreshTracklistDisplay();
}

function refreshTracklistDisplay() {
    const tracklist = document.getElementById('tracklist');
    tracklist.innerHTML = '';
    uploadedTracks.forEach((track, idx) => {
        tracklist.appendChild(createTrackElement(track, idx + 1));
    });
    addSortControls();
}

function refreshTrackNumbers() {
    document.querySelectorAll('.track .track-number').forEach((el, i) => {
        el.textContent = i + 1;
    });
}

// ===================== PERSISTÊNCIA =====================
const DB_NAME = 'SpotiferFileHandles';
const STORE_NAME = 'handles';

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function storeHandlesIfAvailable() {
    const handles = uploadedTracks.map(t => t.handle).filter(h => h != null);
    if (handles.length === 0) return;
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await store.clear();
    for (let i = 0; i < handles.length; i++) {
        await store.put({ id: i, handle: handles[i] });
    }
    await tx.complete;
    db.close();
}

async function getStoredHandles() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const items = await store.getAll();
    await tx.complete;
    db.close();
    return items.sort((a, b) => a.id - b.id).map(item => item.handle);
}

async function restoreSessionIfPossible() {
    const stored = localStorage.getItem('spotifer_session');
    if (!stored) return;
    let metadata;
    try {
        metadata = JSON.parse(stored);
    } catch (e) {
        localStorage.removeItem('spotifer_session');
        return;
    }

    let handles = [];
    try {
        handles = await getStoredHandles();
    } catch (err) {
        console.warn('IndexedDB não acessível:', err);
    }

    if (handles.length > 0 && window.showOpenFilePicker) {
        const restoredTracks = [];
        for (let i = 0; i < handles.length; i++) {
            try {
                const perm = await handles[i].queryPermission({ mode: 'read' });
                if (perm !== 'granted') {
                    await handles[i].requestPermission({ mode: 'read' });
                }
                const file = await handles[i].getFile();
                const url = URL.createObjectURL(file);
                const duration = await getAudioDuration(url);
                restoredTracks.push({
                    name: file.name.replace(/\.[^/.]+$/, ""),
                    customName: metadata[i]?.customName || null,
                    duration,
                    file,
                    url,
                    handle: handles[i],
                    id: trackIdCounter++
                });
            } catch (e) {
                // se não conseguir permissão, ignora
            }
        }
        if (restoredTracks.length > 0) {
            uploadedTracks = restoredTracks;
            return;
        }
    }

    localStorage.removeItem('spotifer_session');
}

function saveSessionMetadata() {
    const metadata = uploadedTracks.map(t => ({
        customName: t.customName || t.name,
        id: t.id
    }));
    localStorage.setItem('spotifer_session', JSON.stringify(metadata));
    storeHandlesIfAvailable();
}

function clearAllTracksSilently() {
    uploadedTracks.forEach(t => URL.revokeObjectURL(t.url));
    uploadedTracks = [];
}

// ===================== FUNÇÕES DE APOIO =====================
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}
function handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
}
function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f =>
        f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|ogg|aac|flac|m4a)$/i)
    );
    if (files.length > 0) processFiles(files);
}

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
function classifyAlbum(count) {
    if (count === 1) return 'Single';
    if (count <= 6) return 'EP';
    return 'Álbum';
}

function updateAlbumInfo() {
    albumData.name = document.getElementById('albumName').value || 'Meu Álbum';
}
function changeCover() {
    document.getElementById('coverFile').click();
}
function handleCoverChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('albumCover').src = e.target.result;
        albumData.cover = e.target.result;
    };
    reader.readAsDataURL(file);
}

function exportAlbum() {
    const data = {
        album: albumData,
        tracks: uploadedTracks.map(t => ({
            name: t.customName || t.name,
            duration: formatDuration(t.duration)
        }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (albumData.name || 'album').replace(/[^a-z0-9]/gi, '_') + '_info.json';
    a.click();
    URL.revokeObjectURL(url);
}

function clearAll() {
    if (!confirm('Tem certeza que deseja limpar tudo? Esta ação não pode ser desfeita.')) return;
    clearAllTracksSilently();
    albumData = { name: '', cover: '', type: '', duration: 0, trackCount: 0 };
    document.getElementById('albumSection').style.display = 'none';
    resetUploadArea();
    localStorage.removeItem('spotifer_session');
    (async () => {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        await tx.objectStore(STORE_NAME).clear();
        await tx.complete;
        db.close();
    })();
}

function resetUploadArea() {
    const uploadArea = document.getElementById('uploadArea');
    uploadArea.innerHTML = `
        <i class="fas fa-cloud-upload-alt"></i>
        <h3>Arraste suas músicas aqui</h3>
        <p>ou clique para selecionar arquivos</p>
        <button class="upload-btn" id="selectFilesBtn">
            Selecionar Arquivos
        </button>
    `;
    // Reconfigura o botão no novo HTML
    const btn = document.getElementById('selectFilesBtn');
    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await handleSelectButtonClick();
    });
    // Reaplica o listener de clique na área (caso o usuário clique fora do botão)
    uploadArea.addEventListener('click', (e) => {
        if (e.target.closest('#selectFilesBtn')) return;
        document.getElementById('musicFiles')?.click();
    });
}

function showProgress(current, total) {
    const uploadArea = document.getElementById('uploadArea');
    const pct = Math.round((current / total) * 100);
    uploadArea.innerHTML = `
        <div class="loading"></div>
        <h3>Processando músicas...</h3>
        <p>${current} de ${total} arquivos (${pct}%)</p>
        <div style="width:100%;background:rgba(255,255,255,0.1);border-radius:10px;margin-top:1rem;">
            <div style="width:${pct}%;background:linear-gradient(135deg,#667eea,#764ba2);height:8px;border-radius:10px;transition:width 0.3s;"></div>
        </div>
    `;
}

// ===================== TEMA CLARO/ESCURO =====================
function applySavedTheme() {
    const savedTheme = localStorage.getItem('spotifer_theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        updateThemeToggleIcon(true);
    } else {
        document.body.classList.remove('light-theme');
        updateThemeToggleIcon(false);
    }
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('spotifer_theme', isLight ? 'light' : 'dark');
    updateThemeToggleIcon(isLight);
}

function updateThemeToggleIcon(isLight) {
    const icon = document.querySelector('#themeToggle i');
    const text = document.querySelector('#themeToggle .toggle-text');
    if (isLight) {
        icon.className = 'fas fa-sun';
        text.textContent = 'Modo Claro';
    } else {
        icon.className = 'fas fa-moon';
        text.textContent = 'Modo Escuro';
    }
}

// Chamar applySavedTheme no início
document.addEventListener('DOMContentLoaded', () => {
    applySavedTheme();
    // resto da sua inicialização...
});

// ===================== MODAL DE CONFIGURAÇÕES =====================
function openSettings() {
    document.getElementById('settingsModal').style.display = 'flex';
    // Fecha com tecla ESC
    document.addEventListener('keydown', handleEscKey);
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
    document.removeEventListener('keydown', handleEscKey);
}

function handleEscKey(e) {
    if (e.key === 'Escape') {
        closeSettings();
    }
}

// Fechar ao clicar fora do modal (no overlay)
document.addEventListener('click', (e) => {
    const modal = document.getElementById('settingsModal');
    if (e.target === modal) {
        closeSettings();
    }
});