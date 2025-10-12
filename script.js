// Variáveis globais
let uploadedTracks = [];
let albumData = {
    name: '',
    cover: '',
    type: '',
    duration: 0,
    trackCount: 0
};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
});

// Configurar event listeners
function setupEventListeners() {
    const uploadArea = document.getElementById('uploadArea');
    const musicFiles = document.getElementById('musicFiles');
    const selectFilesBtn = document.getElementById('selectFilesBtn');

    // Drag and drop
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);

    // File input change
    if (musicFiles) {
        musicFiles.addEventListener('change', handleFileSelect);
    }

    // Click to upload - usar o botão ou área
    if (selectFilesBtn) {
        selectFilesBtn.addEventListener('click', () => {
            if (musicFiles) {
                musicFiles.click();
            }
        });
    } else {
        uploadArea.addEventListener('click', () => {
            if (musicFiles) {
                musicFiles.click();
            }
        });
    }
}

// Drag and drop handlers
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
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
        file.type.startsWith('audio/')
    );
    
    if (files.length > 0) {
        processFiles(files);
    }
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    processFiles(files);
}

// Processar arquivos de música
async function processFiles(files) {
    const uploadArea = document.getElementById('uploadArea');
    
    // Mostrar loading
    uploadArea.innerHTML = `
        <div class="loading"></div>
        <h3>Processando suas músicas...</h3>
        <p>Extraindo informações dos arquivos</p>
    `;

    try {
        const tracks = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const trackData = await extractTrackMetadata(file);
            tracks.push(trackData);
        }

        uploadedTracks = tracks;
        displayAlbum();
        
    } catch (error) {
        console.error('Erro ao processar arquivos:', error);
        showError('Erro ao processar os arquivos de música');
        resetUploadArea();
    }
}

// Extrair metadados da música
function extractTrackMetadata(file) {
    return new Promise((resolve, reject) => {
        const audio = new Audio();
        const url = URL.createObjectURL(file);
        
        audio.addEventListener('loadedmetadata', () => {
            const duration = audio.duration;
            const trackName = file.name.replace(/\.[^/.]+$/, ""); // Remove extensão
            
            resolve({
                name: trackName,
                duration: duration,
                file: file,
                url: url
            });
        });

        audio.addEventListener('error', () => {
            reject(new Error(`Erro ao carregar ${file.name}`));
        });

        audio.src = url;
    });
}

// Exibir informações do álbum
function displayAlbum() {
    const albumSection = document.getElementById('albumSection');
    const albumName = document.getElementById('albumName');
    const albumType = document.getElementById('albumType');
    const albumDuration = document.getElementById('albumDuration');
    const trackCount = document.getElementById('trackCount');
    const tracklist = document.getElementById('tracklist');

    // Calcular informações do álbum
    const totalDuration = uploadedTracks.reduce((sum, track) => sum + track.duration, 0);
    const albumTypeText = classifyAlbum(uploadedTracks.length);
    
    // Atualizar dados do álbum
    albumData = {
        name: albumData.name || 'Meu Álbum',
        cover: albumData.cover || '',
        type: albumTypeText,
        duration: totalDuration,
        trackCount: uploadedTracks.length
    };

    // Atualizar interface
    albumName.value = albumData.name;
    albumType.textContent = albumData.type;
    albumDuration.textContent = formatDuration(totalDuration);
    trackCount.textContent = `${uploadedTracks.length} faixa${uploadedTracks.length !== 1 ? 's' : ''}`;

    // Criar tracklist
    tracklist.innerHTML = '';
    uploadedTracks.forEach((track, index) => {
        const trackElement = createTrackElement(track, index + 1);
        tracklist.appendChild(trackElement);
    });

    // Mostrar seção do álbum
    albumSection.style.display = 'block';
    albumSection.classList.add('fade-in');

    // Reset upload area
    resetUploadArea();
}

// Classificar tipo de álbum
function classifyAlbum(trackCount) {
    if (trackCount === 1) {
        return 'Single';
    } else if (trackCount >= 2 && trackCount <= 6) {
        return 'EP';
    } else {
        return 'Álbum';
    }
}

// Criar elemento de track
function createTrackElement(track, trackNumber) {
    const trackElement = document.createElement('div');
    trackElement.className = 'track';
    trackElement.innerHTML = `
        <div class="track-number">${trackNumber}</div>
        <div class="track-info">
            <div class="track-name">${track.name}</div>
            <div class="track-duration">${formatDuration(track.duration)}</div>
        </div>
    `;
    return trackElement;
}

// Formatar duração
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

// Atualizar informações do álbum
function updateAlbumInfo() {
    const albumName = document.getElementById('albumName').value;
    albumData.name = albumName || 'Meu Álbum';
}

// Mudar capa do álbum
function changeCover() {
    document.getElementById('coverFile').click();
}

function handleCoverChange(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const albumCover = document.getElementById('albumCover');
            albumCover.src = e.target.result;
            albumData.cover = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

// Exportar informações do álbum
function exportAlbum() {
    const exportData = {
        album: albumData,
        tracks: uploadedTracks.map(track => ({
            name: track.name,
            duration: track.duration,
            durationFormatted: formatDuration(track.duration)
        }))
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `${albumData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_info.json`;
    link.click();
}

// Limpar tudo
function clearAll() {
    if (confirm('Tem certeza que deseja limpar tudo? Esta ação não pode ser desfeita.')) {
        uploadedTracks = [];
        albumData = {
            name: '',
            cover: '',
            type: '',
            duration: 0,
            trackCount: 0
        };
        
        document.getElementById('albumSection').style.display = 'none';
        resetUploadArea();
        
        // Limpar input de arquivos
        document.getElementById('musicFiles').value = '';
    }
}

// Reset upload area
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
    
    // Reconfigurar event listeners
    setupEventListeners();
}

// Mostrar erro
function showError(message) {
    const uploadArea = document.getElementById('uploadArea');
    uploadArea.innerHTML = `
        <i class="fas fa-exclamation-triangle" style="color: #ff6b6b;"></i>
        <h3>Erro</h3>
        <p>${message}</p>
        <button class="upload-btn" id="retryBtn">
            Tentar Novamente
        </button>
    `;
    
    // Adicionar event listener para o botão de retry
    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) {
        retryBtn.addEventListener('click', resetUploadArea);
    }
}

// Adicionar suporte para mais formatos de áudio
const supportedFormats = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/aac',
    'audio/flac',
    'audio/m4a'
];

// Validar formato de arquivo
function isValidAudioFile(file) {
    return supportedFormats.includes(file.type) || 
           file.name.match(/\.(mp3|wav|ogg|aac|flac|m4a)$/i);
}

// Melhorar feedback visual durante upload
function showProgress(current, total) {
    const uploadArea = document.getElementById('uploadArea');
    const progress = Math.round((current / total) * 100);
    
    uploadArea.innerHTML = `
        <div class="loading"></div>
        <h3>Processando músicas...</h3>
        <p>${current} de ${total} arquivos processados (${progress}%)</p>
        <div style="width: 100%; background: rgba(255,255,255,0.1); border-radius: 10px; margin-top: 1rem;">
            <div style="width: ${progress}%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 8px; border-radius: 10px; transition: width 0.3s ease;"></div>
        </div>
    `;
}

// Função para ordenar tracks por duração ou nome
function sortTracks(criteria = 'name') {
    if (criteria === 'duration') {
        uploadedTracks.sort((a, b) => b.duration - a.duration);
    } else {
        uploadedTracks.sort((a, b) => a.name.localeCompare(b.name));
    }
    displayAlbum();
}

// Adicionar controles de ordenação na interface
function addSortControls() {
    const tracklistSection = document.querySelector('.tracklist-section h3');
    if (tracklistSection && !document.querySelector('.sort-controls')) {
        const sortControls = document.createElement('div');
        sortControls.className = 'sort-controls';
        sortControls.style.cssText = 'margin-bottom: 1rem; display: flex; gap: 1rem;';
        sortControls.innerHTML = `
            <button onclick="sortTracks('name')" style="padding: 0.5rem 1rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 5px; color: white; cursor: pointer;">
                Ordenar por Nome
            </button>
            <button onclick="sortTracks('duration')" style="padding: 0.5rem 1rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 5px; color: white; cursor: pointer;">
                Ordenar por Duração
            </button>
        `;
        tracklistSection.parentNode.insertBefore(sortControls, tracklistSection.nextSibling);
    }
}

// Atualizar displayAlbum para incluir controles de ordenação
const originalDisplayAlbum = displayAlbum;
displayAlbum = function() {
    originalDisplayAlbum();
    addSortControls();
};
