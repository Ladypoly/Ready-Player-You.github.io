/**
 * Avatar Creator - UI Controller
 *
 * Handles user interface events and updates.
 */

export class UIController {
    constructor(app) {
        this.app = app;
        this.currentCategory = null;
        this.selectedAssets = {};
    }

    init() {
        this.setupGenderSelection();
        this.setupSkinColorPicker();
        this.setupCategoryNavigation();
        this.setupExportModal();
        this.setupRandomButton();
        this.setupDebugPanel();
    }

    setupGenderSelection() {
        const options = document.querySelectorAll('.gender-option');

        options.forEach(option => {
            option.addEventListener('click', () => {
                // Update UI
                options.forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');

                // Load avatar
                const gender = option.dataset.gender;
                this.app.loadAvatar(gender);

                // Refresh current category
                if (this.currentCategory) {
                    this.showCategory(this.currentCategory);
                }
            });
        });
    }

    setupSkinColorPicker() {
        const container = document.getElementById('skinColorSelect');
        if (!container) return;

        // Diverse skin tone presets
        const skinTones = [
            { name: 'Porcelain', color: '#ffe4c9' },
            { name: 'Ivory', color: '#f5d5b8' },
            { name: 'Beige', color: '#e8c4a2' },
            { name: 'Warm Beige', color: '#d4a574' },
            { name: 'Golden', color: '#c68642' },
            { name: 'Caramel', color: '#a5724c' },
            { name: 'Honey', color: '#8d5524' },
            { name: 'Bronze', color: '#704214' },
            { name: 'Espresso', color: '#4a2912' },
            { name: 'Dark', color: '#2d1810' },
        ];

        container.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';

        skinTones.forEach((tone, index) => {
            const swatch = document.createElement('div');
            swatch.className = 'skin-swatch';
            swatch.title = tone.name;
            swatch.dataset.color = tone.color;
            swatch.style.cssText = `
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: ${tone.color};
                cursor: pointer;
                border: 2px solid transparent;
                transition: border-color 0.2s, transform 0.1s;
            `;

            // Default selection (medium tone)
            if (index === 4) {
                swatch.style.borderColor = 'var(--accent-pink)';
            }

            swatch.addEventListener('mouseenter', () => {
                swatch.style.transform = 'scale(1.1)';
            });
            swatch.addEventListener('mouseleave', () => {
                swatch.style.transform = 'scale(1)';
            });

            swatch.addEventListener('click', () => {
                // Update selection visual
                container.querySelectorAll('.skin-swatch').forEach(s => {
                    s.style.borderColor = 'transparent';
                });
                swatch.style.borderColor = 'var(--accent-pink)';

                // Apply skin color
                if (this.app.avatar) {
                    this.app.avatar.setSkinColor(tone.color);
                }
            });

            container.appendChild(swatch);
        });
    }

    setupCategoryNavigation() {
        const buttons = document.querySelectorAll('.category-btn');

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active state
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Show category
                const category = btn.dataset.category;
                this.showCategory(category);
            });
        });
    }

    showCategory(category) {
        this.currentCategory = category;

        // Update title
        const titles = {
            'faceshape': 'Face Shape',
            'eyeshape': 'Eye Shape',
            'noseshape': 'Nose Shape',
            'lipshape': 'Lip Shape',
            'eye': 'Eye Color',
            'eyebrows': 'Eyebrows',
            'hair': 'Hair',
            'beard': 'Beard',
            'glasses': 'Glasses',
            'top': 'Clothing'
        };

        document.getElementById('assetPanelTitle').textContent = titles[category] || category;

        // Get assets for category
        const assets = this.app.getAssetsForCategory(category);
        document.getElementById('assetCount').textContent = `${assets.length} items`;

        // Populate grid
        this.populateAssetGrid(category, assets);
    }

    populateAssetGrid(category, assets) {
        const grid = document.getElementById('assetGrid');
        grid.innerHTML = '';

        // Check if this is a morph-based category
        const isMorph = ['faceshape', 'eyeshape', 'noseshape', 'lipshape'].includes(category);
        const isTexture = ['eye', 'eyebrows'].includes(category);
        const isModel = ['hair', 'beard', 'glasses', 'top', 'bottom', 'footwear', 'outfit', 'headwear', 'facewear', 'facemask'].includes(category);

        // Add color picker for hair and beard
        if (category === 'hair' || category === 'beard') {
            const colorPicker = this.createColorPicker(category);
            grid.appendChild(colorPicker);
        }

        // Show empty state if no assets
        if (assets.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'empty-category';
            emptyMsg.style.cssText = 'width: 100%; padding: 30px; text-align: center; color: #666;';
            emptyMsg.innerHTML = `
                <div style="font-size: 32px; margin-bottom: 10px;">📦</div>
                <div>No ${category} assets available</div>
                <div style="font-size: 11px; margin-top: 5px; color: #555;">
                    Download more from readyplayer.me
                </div>
            `;
            grid.appendChild(emptyMsg);
            return;
        }

        // Add "None" option for model-based categories
        if (isModel) {
            const noneItem = this.createAssetItem(category, null, false, false);
            grid.appendChild(noneItem);
        }

        // Show all assets
        for (const asset of assets) {
            const item = this.createAssetItem(category, asset, isMorph, isTexture);
            grid.appendChild(item);
        }
    }

    createColorPicker(category) {
        const container = document.createElement('div');
        container.className = 'color-picker-container';
        container.style.cssText = 'grid-column: 1 / -1; padding: 15px; background: var(--bg-card); border-radius: 12px; margin-bottom: 10px;';

        const label = document.createElement('label');
        label.textContent = category === 'hair' ? 'Hair Color' : 'Beard Color';
        label.style.cssText = 'display: block; margin-bottom: 10px; font-size: 13px; color: #aaa;';

        const colorRow = document.createElement('div');
        colorRow.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap; align-items: center;';

        // Preset colors
        const presets = [
            { name: 'Black', color: '#1a1a1a' },
            { name: 'Dark Brown', color: '#3d2314' },
            { name: 'Brown', color: '#6b4423' },
            { name: 'Light Brown', color: '#a67b5b' },
            { name: 'Blonde', color: '#e6c87a' },
            { name: 'Platinum', color: '#f5f5dc' },
            { name: 'Ginger', color: '#b55239' },
            { name: 'Red', color: '#8b0000' },
            { name: 'Gray', color: '#808080' },
            { name: 'White', color: '#e8e8e8' },
        ];

        presets.forEach(preset => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.title = preset.name;
            swatch.style.cssText = `
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: ${preset.color};
                cursor: pointer;
                border: 2px solid transparent;
                transition: border-color 0.2s, transform 0.1s;
            `;

            swatch.addEventListener('mouseenter', () => {
                swatch.style.transform = 'scale(1.1)';
            });
            swatch.addEventListener('mouseleave', () => {
                swatch.style.transform = 'scale(1)';
            });

            swatch.addEventListener('click', () => {
                // Remove selection from other swatches
                colorRow.querySelectorAll('.color-swatch').forEach(s => {
                    s.style.borderColor = 'transparent';
                });
                swatch.style.borderColor = 'var(--accent-pink)';

                // Apply color
                if (category === 'hair') {
                    this.app.avatar.setHairColor(preset.color);
                } else {
                    this.app.avatar.setBeardColor(preset.color);
                }

                // Also update custom picker
                customInput.value = preset.color;
            });

            colorRow.appendChild(swatch);
        });

        // Custom color input
        const customInput = document.createElement('input');
        customInput.type = 'color';
        customInput.value = category === 'hair' ? this.app.avatar.getHairColor() : this.app.avatar.getBeardColor();
        customInput.style.cssText = `
            width: 28px;
            height: 28px;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            padding: 0;
            background: none;
        `;
        customInput.title = 'Custom color';

        customInput.addEventListener('input', (e) => {
            // Remove selection from preset swatches
            colorRow.querySelectorAll('.color-swatch').forEach(s => {
                s.style.borderColor = 'transparent';
            });

            if (category === 'hair') {
                this.app.avatar.setHairColor(e.target.value);
            } else {
                this.app.avatar.setBeardColor(e.target.value);
            }
        });

        colorRow.appendChild(customInput);

        container.appendChild(label);
        container.appendChild(colorRow);

        return container;
    }

    createToggleItem(category, action, label) {
        const item = document.createElement('div');
        item.className = 'asset-item toggle-item';
        item.dataset.action = action;
        item.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 13px;">
                ${action === 'show' ? '👁 Show' : '🚫 Hide'}
            </div>
        `;

        item.addEventListener('click', () => {
            if (action === 'show') {
                if (category === 'hair') this.app.avatar.showHair();
                if (category === 'beard') this.app.avatar.showBeard();
            } else {
                if (category === 'hair') this.app.avatar.hideHair();
                if (category === 'beard') this.app.avatar.hideBeard();
            }

            // Update selection
            const grid = document.getElementById('assetGrid');
            grid.querySelectorAll('.toggle-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
        });

        return item;
    }

    createAssetItem(category, asset, isMorph = false, isTexture = false) {
        const item = document.createElement('div');
        item.className = 'asset-item';

        if (!asset) {
            // "None" option
            item.classList.add('none');
            item.innerHTML = '<span>None</span>';
            item.dataset.name = 'none';

            item.addEventListener('click', () => {
                this.onAssetClick(category, 'none', false, false);
            });
        } else {
            item.dataset.name = asset.name;

            // Try to load thumbnail
            const thumbPath = `../rpm_library/assets/${category}/${asset.name}/thumbnail.png`;

            const img = document.createElement('img');
            img.src = thumbPath;
            img.alt = asset.name;
            img.loading = 'lazy';
            img.onerror = () => {
                // Fallback to placeholder
                img.src = 'data:image/svg+xml,' + encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
                        <rect fill="#222" width="120" height="120"/>
                        <text x="60" y="60" text-anchor="middle" fill="#666" font-size="12">${asset.name}</text>
                    </svg>
                `);
            };

            item.appendChild(img);

            // Add name label
            const nameLabel = document.createElement('span');
            nameLabel.className = 'asset-name';
            nameLabel.textContent = asset.name;
            item.appendChild(nameLabel);

            // Check if selected
            if (this.selectedAssets[category] === asset.name) {
                item.classList.add('selected');
            }

            item.addEventListener('click', () => {
                this.onAssetClick(category, asset.name, isMorph, isTexture);
            });
        }

        return item;
    }

    onAssetClick(category, assetName, isMorph, isTexture) {
        // Update selection UI
        const grid = document.getElementById('assetGrid');
        grid.querySelectorAll('.asset-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.name === assetName);
        });

        // Store selection
        this.selectedAssets[category] = assetName;

        // Apply to avatar
        if (isMorph) {
            // Reset other morphs in this category first
            const assets = this.app.getAssetsForCategory(category);
            for (const a of assets) {
                this.app.avatar.applyMorph(a.name, 0);
            }
            // Apply selected morph
            if (assetName !== 'none') {
                this.app.selectMorph(category, assetName, 0.5);
            }
        } else if (isTexture) {
            if (assetName !== 'none') {
                this.app.avatar.loadTexture(category, assetName);
            }
        } else {
            this.app.selectAsset(category, assetName);
        }
    }

    updateAssetSelection(category, assetName) {
        this.selectedAssets[category] = assetName;

        // Update grid if visible
        if (this.currentCategory === category) {
            const grid = document.getElementById('assetGrid');
            grid.querySelectorAll('.asset-item').forEach(item => {
                item.classList.toggle('selected', item.dataset.name === assetName);
            });
        }
    }

    setupExportModal() {
        const modal = document.getElementById('exportModal');
        const exportBtn = document.getElementById('exportBtn');
        const closeBtn = document.getElementById('closeModal');
        const exportOptions = document.querySelectorAll('.export-option');

        let selectedFormat = 'glb';

        exportBtn.addEventListener('click', () => {
            modal.classList.add('open');
        });

        closeBtn.addEventListener('click', () => {
            modal.classList.remove('open');
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('open');
            }
        });

        exportOptions.forEach(option => {
            option.addEventListener('click', () => {
                exportOptions.forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                selectedFormat = option.dataset.format;

                // Trigger export
                const name = document.getElementById('avatarName').value || 'MyAvatar';
                this.app.export(selectedFormat, name);
                modal.classList.remove('open');
            });
        });
    }

    setupRandomButton() {
        const btn = document.getElementById('randomBtn');
        btn.addEventListener('click', () => {
            this.app.randomize();
            // Refresh current category view
            if (this.currentCategory) {
                this.showCategory(this.currentCategory);
            }
        });
    }

    setupDebugPanel() {
        // Create debug panel
        const panel = document.createElement('div');
        panel.id = 'debugPanel';
        panel.innerHTML = `
            <div class="debug-header">
                <span>Debug: Asset Offsets</span>
                <button id="debugToggle">−</button>
            </div>
            <div class="debug-content">
                <div class="debug-section">
                    <h4>Hair Offset</h4>
                    <div class="debug-row">
                        <label>X:</label>
                        <input type="range" id="hairOffsetX" min="-0.5" max="0.5" step="0.01" value="0">
                        <span id="hairOffsetXVal">0.00</span>
                    </div>
                    <div class="debug-row">
                        <label>Y:</label>
                        <input type="range" id="hairOffsetY" min="-0.5" max="0.5" step="0.01" value="0">
                        <span id="hairOffsetYVal">0.00</span>
                    </div>
                    <div class="debug-row">
                        <label>Z:</label>
                        <input type="range" id="hairOffsetZ" min="-0.5" max="0.5" step="0.01" value="0">
                        <span id="hairOffsetZVal">0.00</span>
                    </div>
                </div>
                <div class="debug-section">
                    <h4>Beard Offset</h4>
                    <div class="debug-row">
                        <label>X:</label>
                        <input type="range" id="beardOffsetX" min="-0.5" max="0.5" step="0.01" value="0">
                        <span id="beardOffsetXVal">0.00</span>
                    </div>
                    <div class="debug-row">
                        <label>Y:</label>
                        <input type="range" id="beardOffsetY" min="-0.5" max="0.5" step="0.01" value="0">
                        <span id="beardOffsetYVal">0.00</span>
                    </div>
                    <div class="debug-row">
                        <label>Z:</label>
                        <input type="range" id="beardOffsetZ" min="-0.5" max="0.5" step="0.01" value="0">
                        <span id="beardOffsetZVal">0.00</span>
                    </div>
                </div>
                <div class="debug-section">
                    <h4>Glasses Offset</h4>
                    <div class="debug-row">
                        <label>X:</label>
                        <input type="range" id="glassesOffsetX" min="-0.5" max="0.5" step="0.01" value="0">
                        <span id="glassesOffsetXVal">0.00</span>
                    </div>
                    <div class="debug-row">
                        <label>Y:</label>
                        <input type="range" id="glassesOffsetY" min="-0.5" max="0.5" step="0.01" value="0">
                        <span id="glassesOffsetYVal">0.00</span>
                    </div>
                    <div class="debug-row">
                        <label>Z:</label>
                        <input type="range" id="glassesOffsetZ" min="-0.5" max="0.5" step="0.01" value="0">
                        <span id="glassesOffsetZVal">0.00</span>
                    </div>
                </div>
                <div class="debug-output">
                    <button id="copyOffsets">Copy Values</button>
                    <pre id="offsetValues"></pre>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #debugPanel {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 280px;
                background: rgba(20, 20, 25, 0.95);
                border: 1px solid var(--accent-pink);
                border-radius: 12px;
                font-size: 12px;
                z-index: 1000;
                box-shadow: 0 4px 20px rgba(233, 51, 146, 0.3);
            }
            .debug-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 15px;
                background: var(--accent-pink);
                color: white;
                font-weight: bold;
                border-radius: 11px 11px 0 0;
            }
            .debug-header button {
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                width: 24px;
                height: 24px;
                line-height: 1;
            }
            .debug-content {
                padding: 15px;
                max-height: 400px;
                overflow-y: auto;
            }
            .debug-content.collapsed {
                display: none;
            }
            .debug-section {
                margin-bottom: 15px;
            }
            .debug-section h4 {
                margin: 0 0 8px 0;
                color: var(--accent-pink);
                font-size: 13px;
            }
            .debug-row {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 5px;
            }
            .debug-row label {
                width: 20px;
                color: #888;
            }
            .debug-row input[type="range"] {
                flex: 1;
                height: 4px;
                -webkit-appearance: none;
                background: #333;
                border-radius: 2px;
            }
            .debug-row input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 14px;
                height: 14px;
                background: var(--accent-pink);
                border-radius: 50%;
                cursor: pointer;
            }
            .debug-row span {
                width: 40px;
                text-align: right;
                color: #aaa;
                font-family: monospace;
            }
            .debug-output {
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid #333;
            }
            .debug-output button {
                width: 100%;
                padding: 8px;
                background: var(--accent-pink);
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                margin-bottom: 8px;
            }
            .debug-output button:hover {
                background: #d62a82;
            }
            .debug-output pre {
                background: #0a0a0a;
                padding: 10px;
                border-radius: 6px;
                color: #0f0;
                font-size: 10px;
                margin: 0;
                white-space: pre-wrap;
                word-break: break-all;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(panel);

        // Toggle collapse
        const toggle = document.getElementById('debugToggle');
        const content = panel.querySelector('.debug-content');
        toggle.addEventListener('click', () => {
            content.classList.toggle('collapsed');
            toggle.textContent = content.classList.contains('collapsed') ? '+' : '−';
        });

        // Setup sliders for each category
        ['hair', 'beard', 'glasses'].forEach(category => {
            ['X', 'Y', 'Z'].forEach(axis => {
                const slider = document.getElementById(`${category}Offset${axis}`);
                const valueDisplay = document.getElementById(`${category}Offset${axis}Val`);

                slider.addEventListener('input', () => {
                    const value = parseFloat(slider.value);
                    valueDisplay.textContent = value.toFixed(2);

                    // Update the offset in avatar manager
                    this.updateAssetOffset(category, axis.toLowerCase(), value);

                    // Update output display
                    this.updateOffsetDisplay();
                });
            });
        });

        // Copy button
        document.getElementById('copyOffsets').addEventListener('click', () => {
            const pre = document.getElementById('offsetValues');
            navigator.clipboard.writeText(pre.textContent);
            document.getElementById('copyOffsets').textContent = 'Copied!';
            setTimeout(() => {
                document.getElementById('copyOffsets').textContent = 'Copy Values';
            }, 1500);
        });

        // Initial display
        this.updateOffsetDisplay();
    }

    updateAssetOffset(category, axis, value) {
        const asset = this.app.avatar.loadedAssets[category];
        if (asset && asset.container) {
            asset.container.position[axis] = value;
        }

        // Also update the stored offset for new loads
        if (!this.app.avatar.debugOffsets) {
            this.app.avatar.debugOffsets = {
                hair: { x: 0, y: 0, z: 0 },
                beard: { x: 0, y: 0, z: 0 },
                glasses: { x: 0, y: 0, z: 0 }
            };
        }
        this.app.avatar.debugOffsets[category][axis] = value;
    }

    updateOffsetDisplay() {
        const getVal = (cat, axis) => {
            const slider = document.getElementById(`${cat}Offset${axis}`);
            return parseFloat(slider.value).toFixed(2);
        };

        const output = `// Correct offset values:
hair: { x: ${getVal('hair', 'X')}, y: ${getVal('hair', 'Y')}, z: ${getVal('hair', 'Z')} }
beard: { x: ${getVal('beard', 'X')}, y: ${getVal('beard', 'Y')}, z: ${getVal('beard', 'Z')} }
glasses: { x: ${getVal('glasses', 'X')}, y: ${getVal('glasses', 'Y')}, z: ${getVal('glasses', 'Z')} }`;

        document.getElementById('offsetValues').textContent = output;
    }
}
