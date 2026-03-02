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
            this.hideLoading();
        } catch (error) {
            console.error('Failed to load avatar:', error);
            this.hideLoading();
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
            if (item.gender && item.gender !== 'neutral' && item.gender !== this.currentGender) {
                return false;
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
        // Select random assets for each category
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
