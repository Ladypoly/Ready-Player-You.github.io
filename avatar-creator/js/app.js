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
        console.log('Applying random defaults...');

        try {
            // Random hair
            const hairAssets = this.getAssetsForCategory('hair');
            console.log(`Found ${hairAssets.length} hair assets`);
            if (hairAssets.length > 0) {
                const randomHair = hairAssets[Math.floor(Math.random() * hairAssets.length)];
                console.log(`Loading hair: ${randomHair.name}`);
                await this.avatar.loadAsset('hair', randomHair.name);
                this.selectedAssets['hair'] = randomHair.name;
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

            // Random outfit (always give them clothes!)
            const outfits = this.getAssetsForCategory('outfit');
            console.log(`Found ${outfits.length} outfit assets`);
            if (outfits.length > 0) {
                const randomOutfit = outfits[Math.floor(Math.random() * outfits.length)];
                console.log(`Loading outfit: ${randomOutfit.name}`);
                await this.avatar.loadAsset('outfit', randomOutfit.name);
                this.selectedAssets['outfit'] = randomOutfit.name;
            } else {
                // Fallback to individual pieces if no outfits
                console.log('No outfits found, trying individual pieces...');
                for (const category of ['top', 'bottom', 'footwear']) {
                    const assets = this.getAssetsForCategory(category);
                    if (assets.length > 0) {
                        const randomAsset = assets[Math.floor(Math.random() * assets.length)];
                        console.log(`Loading ${category}: ${randomAsset.name}`);
                        await this.avatar.loadAsset(category, randomAsset.name);
                        this.selectedAssets[category] = randomAsset.name;
                    }
                }
            }

            console.log('Applied random defaults successfully');
        } catch (error) {
            console.error('Error applying random defaults:', error);
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

        return typeData.items.filter(item => {
            // Filter by gender if needed
            if (category === 'beard' && this.currentGender === 'female') {
                return false;
            }

            // Check metadata gender
            if (item.gender && item.gender !== 'neutral' && item.gender !== this.currentGender) {
                return false;
            }

            // Also check asset name for gender hints (outfit-f-, outfit-m-, -v2-f, -v2-m)
            const name = item.name.toLowerCase();
            if (this.currentGender === 'male') {
                // Exclude female-specific assets
                if (name.includes('-f-') || name.endsWith('-f') || name.includes('-v2-f')) {
                    return false;
                }
            } else if (this.currentGender === 'female') {
                // Exclude male-specific assets
                if (name.includes('-m-') || name.endsWith('-m') || name.includes('-v2-m')) {
                    return false;
                }
            }

            return true;
        });
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
