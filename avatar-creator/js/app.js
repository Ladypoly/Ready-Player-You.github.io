/**
 * Avatar Creator - Main Application
 *
 * Entry point that initializes all modules and coordinates the application.
 */

import { Scene3D } from './scene.js';
import { AvatarManager } from './avatar.js';
import { UIController } from './ui.js';
import { Exporter } from './export.js';

class AvatarCreatorApp {
    constructor() {
        this.catalog = null;
        this.scene = null;
        this.avatar = null;
        this.ui = null;
        this.exporter = null;

        this.currentGender = 'male';
        this.currentCategory = 'faceshape';
        this.selectedAssets = {};
        this.morphValues = {};
    }

    async init() {
        console.log('Initializing Avatar Creator...');

        try {
            // Load catalog
            await this.loadCatalog();

            // Initialize 3D scene
            this.scene = new Scene3D('canvas-container');
            await this.scene.init();

            // Initialize avatar manager
            this.avatar = new AvatarManager(this.scene, this.catalog);

            // Initialize UI
            this.ui = new UIController(this);
            this.ui.init();

            // Initialize exporter
            this.exporter = new Exporter(this.scene, this.avatar);

            // Load default avatar
            await this.loadAvatar('male');

            // Show default category
            this.ui.showCategory('faceshape');

            // Hide loading
            this.hideLoading();

            console.log('Avatar Creator initialized successfully!');
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showError('Failed to load avatar creator. Please refresh the page.');
        }
    }

    async loadCatalog() {
        const response = await fetch('../rpm_library/catalog.json');
        if (!response.ok) {
            throw new Error('Failed to load catalog');
        }
        this.catalog = await response.json();
        console.log(`Loaded catalog with ${this.catalog.totalAssets} assets`);
    }

    async loadAvatar(gender) {
        this.showLoading();
        this.currentGender = gender;
        this.selectedAssets = {};
        this.morphValues = {};

        try {
            await this.avatar.loadBase(gender);

            // Apply random defaults since base avatar is minimal
            await this.applyRandomDefaults();

            this.hideLoading();
        } catch (error) {
            console.error('Failed to load avatar:', error);
            this.hideLoading();
        }
    }

    async applyRandomDefaults() {
        console.log(`Applying random defaults for gender: ${this.currentGender}`);

        // Random hair - try up to 3 times if asset fails to load
        const hairAssets = this.getAssetsForCategory('hair');
        console.log(`Found ${hairAssets.length} hair assets`);

        let hairLoaded = false;
        const triedHair = new Set();
        for (let i = 0; i < Math.min(5, hairAssets.length) && !hairLoaded; i++) {
            const randomHair = hairAssets[Math.floor(Math.random() * hairAssets.length)];
            if (triedHair.has(randomHair.name)) continue;
            triedHair.add(randomHair.name);
            try {
                await this.avatar.loadAsset('hair', randomHair.name);
                this.selectedAssets['hair'] = randomHair.name;
                hairLoaded = true;
            } catch (error) {
                console.warn(`Hair ${randomHair.name} failed`);
            }
        }

        // Random face morphs
        const morphCategories = ['faceshape', 'eyeshape', 'noseshape', 'lipshape'];
        for (const category of morphCategories) {
            const assets = this.getAssetsForCategory(category);
            if (assets.length > 0) {
                const randomMorph = assets[Math.floor(Math.random() * assets.length)];
                this.avatar.applyMorph(randomMorph.name, 0.5);
                this.morphValues[randomMorph.name] = 0.5;
            }
        }

        // Clothing strategy:
        // - Female: use outfits (all 111 outfits are female-specific)
        // - Male: use individual pieces (top + bottom + footwear are neutral)

        if (this.currentGender === 'female') {
            // Female gets an outfit
            const outfits = this.getAssetsForCategory('outfit');
            console.log(`Found ${outfits.length} outfits for female`);

            let outfitLoaded = false;
            const triedOutfits = new Set();
            for (let i = 0; i < Math.min(5, outfits.length) && !outfitLoaded; i++) {
                const randomOutfit = outfits[Math.floor(Math.random() * outfits.length)];
                if (triedOutfits.has(randomOutfit.name)) continue;
                triedOutfits.add(randomOutfit.name);
                try {
                    await this.avatar.loadAsset('outfit', randomOutfit.name);
                    this.selectedAssets['outfit'] = randomOutfit.name;
                    outfitLoaded = true;
                } catch (error) {
                    console.warn(`Outfit ${randomOutfit.name} failed`);
                }
            }
        } else {
            // Male uses individual pieces (no male outfits exist)
            console.log('Male avatar: using individual pieces');
            await this.loadRandomIndividualClothing();
        }

        console.log('Random defaults applied');
    }

    async loadRandomIndividualClothing() {
        for (const category of ['top', 'bottom', 'footwear']) {
            const assets = this.getAssetsForCategory(category);
            if (assets.length > 0) {
                let loaded = false;
                const tried = new Set();
                for (let i = 0; i < Math.min(3, assets.length) && !loaded; i++) {
                    const randomAsset = assets[Math.floor(Math.random() * assets.length)];
                    if (tried.has(randomAsset.name)) continue;
                    tried.add(randomAsset.name);
                    try {
                        await this.avatar.loadAsset(category, randomAsset.name);
                        this.selectedAssets[category] = randomAsset.name;
                        loaded = true;
                    } catch (error) {
                        console.warn(`${category} ${randomAsset.name} failed`);
                    }
                }
            }
        }
    }

    async selectAsset(category, assetName) {
        if (assetName === 'none') {
            // Remove asset
            this.avatar.removeAsset(category);
            delete this.selectedAssets[category];
        } else {
            // Load and apply asset
            try {
                await this.avatar.loadAsset(category, assetName);
                this.selectedAssets[category] = assetName;
            } catch (error) {
                console.error(`Failed to load asset ${assetName}:`, error);
            }
        }

        this.ui.updateAssetSelection(category, assetName);
    }

    selectMorph(category, morphName, value) {
        this.morphValues[morphName] = value;
        this.avatar.applyMorph(morphName, value);
        this.ui.updateAssetSelection(category, morphName);
    }

    getAssetsForCategory(category) {
        const typeData = this.catalog.assetTypes[category];
        if (!typeData) return [];

        const gender = this.currentGender;

        const filtered = typeData.items.filter(item => {
            // Beard only for male
            if (category === 'beard' && gender === 'female') {
                return false;
            }

            const name = item.name.toLowerCase();

            // Check for female-specific patterns
            const isFemaleAsset = this.isAssetForGender(name, 'female');
            const isMaleAsset = this.isAssetForGender(name, 'male');

            // If asset is gender-specific, must match current gender
            if (isFemaleAsset && gender !== 'female') {
                return false;
            }
            if (isMaleAsset && gender !== 'male') {
                return false;
            }

            // Also check metadata gender field
            if (item.gender && item.gender !== 'neutral' && item.gender !== gender) {
                return false;
            }

            return true;
        });

        return filtered;
    }

    /**
     * Check if asset name indicates a specific gender
     */
    isAssetForGender(name, targetGender) {
        if (targetGender === 'female') {
            return name.includes('-f-') ||
                   name.endsWith('-f') ||
                   name.includes('-v2-f') ||
                   name.includes('_f_') ||
                   name.includes('-female') ||
                   name.match(/outfit-f[^a-z]/) ||  // outfit-f followed by non-letter
                   name.includes('dress') ||
                   name.includes('skirt') ||
                   name.includes('-cheer-') ||
                   name.includes('wedding') ||
                   name.includes('angel-') && name.includes('-f');
        } else if (targetGender === 'male') {
            return name.includes('-m-') ||
                   name.endsWith('-m') ||
                   name.includes('-v2-m') ||
                   name.includes('_m_') ||
                   name.includes('-male') ||
                   name.match(/outfit-m[^a-z]/);  // outfit-m followed by non-letter
        }
        return false;
    }

    showLoading() {
        document.getElementById('loadingOverlay').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }

    showError(message) {
        // Simple error display
        const overlay = document.getElementById('loadingOverlay');
        overlay.innerHTML = `<p style="color: #ff6b6b;">${message}</p>`;
    }

    randomize() {
        // Select random hair/eyebrows/beard
        const categories = ['hair', 'eyebrows'];
        if (this.currentGender === 'male') {
            categories.push('beard');
        }

        for (const category of categories) {
            const assets = this.getAssetsForCategory(category);
            if (assets.length > 0) {
                const randomAsset = assets[Math.floor(Math.random() * assets.length)];
                this.selectAsset(category, randomAsset.name);
            }
        }

        // Random morph values
        const morphCategories = ['faceshape', 'eyeshape', 'noseshape', 'lipshape'];
        for (const category of morphCategories) {
            const assets = this.getAssetsForCategory(category);
            if (assets.length > 0) {
                const randomMorph = assets[Math.floor(Math.random() * assets.length)];
                this.selectMorph(category, randomMorph.name, 0.5);
            }
        }

        // Smart clothing randomization: 50% full outfit, 50% individual pieces
        if (Math.random() < 0.5) {
            // Option A: Full outfit
            const outfits = this.getAssetsForCategory('outfit');
            if (outfits.length > 0) {
                const randomOutfit = outfits[Math.floor(Math.random() * outfits.length)];
                this.selectAsset('outfit', randomOutfit.name);
                // Mutual exclusion in avatar.js auto-clears individual clothing
            }
        } else {
            // Option B: Individual pieces
            this.selectAsset('outfit', 'none'); // Clear any outfit first

            for (const category of ['top', 'bottom', 'footwear']) {
                const assets = this.getAssetsForCategory(category);
                if (assets.length > 0) {
                    const randomAsset = assets[Math.floor(Math.random() * assets.length)];
                    this.selectAsset(category, randomAsset.name);
                }
            }
        }

        // Randomize accessories (30% chance each)
        for (const category of ['glasses', 'headwear', 'facewear']) {
            if (Math.random() < 0.3) {
                const assets = this.getAssetsForCategory(category);
                if (assets.length > 0) {
                    const randomAsset = assets[Math.floor(Math.random() * assets.length)];
                    this.selectAsset(category, randomAsset.name);
                }
            } else {
                this.selectAsset(category, 'none');
            }
        }
    }

    async export(format, name) {
        try {
            await this.exporter.export(format, name);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Please try again.');
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AvatarCreatorApp();
    window.app.init();
});
