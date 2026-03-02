/**
 * Avatar Creator - Avatar Management (Clean Rewrite)
 *
 * Key principles:
 * - Single state object for easy reset
 * - Validate before acting
 * - Clear before load
 * - Parent-agnostic removal
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class AvatarManager {
    constructor(sceneManager, catalog) {
        this.sceneManager = sceneManager;
        this.threeScene = sceneManager.scene; // Direct THREE.Scene reference
        this.catalog = catalog;
        this.loader = new GLTFLoader();
        this.basePath = '../rpm_library';

        // Colors (persist across avatar switches)
        this.hairColor = new THREE.Color(0x3d2314);
        this.beardColor = new THREE.Color(0x3d2314);
        this.skinColor = new THREE.Color(0xc68642);

        // Debug offsets (set via debug panel)
        this.debugOffsets = null;

        // Single state object - easy to fully reset
        this.state = this.createEmptyState();
    }

    createEmptyState() {
        return {
            avatar: null,
            gender: null,
            headBone: null,
            hipsBone: null,
            meshes: {},
            bones: {},
            morphTargets: {},
            assets: {} // { category: { container, model, name } }
        };
    }

    /**
     * FULL RESET - removes everything from scene completely
     */
    fullReset() {
        console.log('=== FULL RESET ===');

        // 1. Remove all assets first (they're attached to avatar or headBone)
        for (const category of Object.keys(this.state.assets)) {
            this.removeAsset(category);
        }

        // 2. Remove avatar from scene
        if (this.state.avatar) {
            console.log('Removing avatar from scene');
            this.threeScene.remove(this.state.avatar);
            this.disposeObject(this.state.avatar);
        }

        // 3. Reset state completely
        this.state = this.createEmptyState();

        console.log('=== RESET COMPLETE ===');
    }

    /**
     * Load base avatar for gender
     */
    async loadBase(gender) {
        return this.loadAvatar(gender === 'female' ? 'female_default' : 'male_default');
    }

    /**
     * Load avatar - always does full reset first
     */
    async loadAvatar(avatarName) {
        console.log(`Loading avatar: ${avatarName}`);

        // ALWAYS full reset first - this is critical
        this.fullReset();

        const path = `${this.basePath}/avatars/${avatarName}.glb`;

        try {
            const gltf = await this.loadGLTF(path);
            this.state.avatar = gltf.scene;
            this.state.gender = avatarName.includes('female') ? 'female' : 'male';

            // Setup avatar
            this.state.avatar.position.set(0, 0, 0);
            this.state.avatar.scale.set(1, 1, 1);

            // Index meshes, bones, and morph targets
            this.state.avatar.traverse((child) => {
                if (child.isMesh) {
                    this.state.meshes[child.name] = child;
                    child.castShadow = true;
                    child.receiveShadow = true;

                    if (child.morphTargetInfluences && child.morphTargetDictionary) {
                        this.indexMorphTargets(child);
                    }
                }

                if (child.isBone) {
                    this.state.bones[child.name] = child;
                    if (child.name === 'Head') {
                        this.state.headBone = child;
                    }
                    if (child.name === 'Hips') {
                        this.state.hipsBone = child;
                    }
                }
            });

            // Validate we found head bone
            if (!this.state.headBone) {
                console.warn('No Head bone found in avatar!');
            }

            // Add to scene
            this.threeScene.add(this.state.avatar);

            // Hide built-in hair/beard (we use raw assets)
            this.hideBuiltInHair();
            this.hideBuiltInBeard();

            console.log(`Loaded avatar: ${Object.keys(this.state.meshes).length} meshes, ${Object.keys(this.state.bones).length} bones`);

            return this.state.avatar;
        } catch (error) {
            console.error('Failed to load avatar:', error);
            throw error;
        }
    }

    /**
     * Load and attach an asset
     */
    async loadAsset(category, assetName) {
        console.log(`Loading ${category}: ${assetName}`);

        // Validate we have an avatar
        if (!this.state.avatar) {
            console.error('Cannot load asset - no avatar loaded');
            return;
        }

        // Remove existing asset of this category FIRST
        this.removeAsset(category);

        if (assetName === 'none') {
            return;
        }

        // Handle mutual exclusion: outfit vs individual clothing
        if (category === 'outfit') {
            this.removeAsset('top');
            this.removeAsset('bottom');
            this.removeAsset('footwear');
        } else if (['top', 'bottom', 'footwear'].includes(category)) {
            this.removeAsset('outfit');
        }

        const isHeadAttached = ['hair', 'beard', 'glasses', 'facewear', 'headwear', 'facemask'].includes(category);
        const isClothing = ['outfit', 'top', 'bottom', 'footwear'].includes(category);
        const isHairOrBeard = category === 'hair' || category === 'beard';

        // Validate head bone for head-attached items
        if (isHeadAttached && !this.state.headBone) {
            console.error('Cannot attach head asset - no head bone');
            return;
        }

        const assetFolder = `${this.basePath}/assets/${category}/${assetName}`;

        try {
            // Load model and optional texture
            const loadPromises = [this.loadGLTF(`${assetFolder}/model.glb`)];

            if (isHairOrBeard) {
                loadPromises.push(this.loadTextureFile(`${assetFolder}/mask.png`).catch(() => null));
            } else {
                loadPromises.push(this.loadTextureFile(`${assetFolder}/texture.png`).catch(() => null));
            }

            const [gltf, texture] = await Promise.all(loadPromises);
            const model = gltf.scene;

            // Create container
            const container = new THREE.Group();
            container.name = `${category}_asset`;

            // Apply materials
            const assetColor = category === 'hair' ? this.hairColor :
                               category === 'beard' ? this.beardColor : null;

            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    if (child.material) {
                        if (isHairOrBeard && assetColor) {
                            child.material.color = assetColor.clone();
                            if (texture) {
                                child.material.alphaMap = texture;
                                child.material.transparent = true;
                                child.material.alphaTest = 0.5;
                            }
                        } else if (texture) {
                            child.material.map = texture;
                        }
                        child.material.needsUpdate = true;
                    }
                }
            });

            container.add(model);

            // Apply body morphs and skin color for clothing
            if (isClothing) {
                this.applyBodyMorphs(model);
                this.applySkinColorToModel(model);
            }

            // Attach to correct parent
            if (isHeadAttached) {
                this.state.headBone.add(container);
                container.position.copy(this.getAssetOffset(category));
            } else {
                this.state.avatar.add(container);
                container.position.set(0, 0, 0);
            }

            // Store reference
            this.state.assets[category] = {
                container,
                model,
                name: assetName
            };

            // Update body visibility
            if (isClothing) {
                this.updateBodyVisibility();
            }

            console.log(`Loaded ${category}: ${assetName}`);

        } catch (error) {
            console.error(`Failed to load ${category} "${assetName}":`, error);
        }
    }

    /**
     * Remove asset - uses parent-agnostic removal
     */
    removeAsset(category) {
        const asset = this.state.assets[category];
        if (!asset) return;

        // Parent-agnostic removal - works regardless of what it's attached to
        if (asset.container && asset.container.parent) {
            asset.container.parent.remove(asset.container);
        }

        // Dispose resources
        if (asset.container) {
            this.disposeObject(asset.container);
        }

        // Clear reference
        delete this.state.assets[category];

        console.log(`Removed ${category}`);

        // Update body visibility if clothing was removed
        if (['outfit', 'top', 'bottom', 'footwear'].includes(category)) {
            this.updateBodyVisibility();
        }
    }

    /**
     * Get asset offset for head-attached items
     */
    getAssetOffset(category) {
        const offset = new THREE.Vector3(0, 0, 0);

        // Check debug offsets first
        if (this.debugOffsets && this.debugOffsets[category]) {
            offset.x = this.debugOffsets[category].x || 0;
            offset.y = this.debugOffsets[category].y || 0;
            offset.z = this.debugOffsets[category].z || 0;
            return offset;
        }

        const isFemale = this.state.gender === 'female';

        switch (category) {
            case 'hair':
                offset.y = isFemale ? -0.10 : -0.08;
                offset.z = isFemale ? 0.01 : 0.02;
                break;
            case 'beard':
                offset.y = -0.09;
                offset.z = 0.03;
                break;
            case 'glasses':
                offset.y = -0.08;
                offset.z = isFemale ? 0.02 : 0.03;
                break;
            case 'headwear':
                offset.y = -0.08;
                break;
            case 'facewear':
            case 'facemask':
                offset.y = -0.08;
                offset.z = 0.02;
                break;
        }

        return offset;
    }

    // ==================== MORPH TARGETS ====================

    indexMorphTargets(mesh) {
        const morphDict = mesh.morphTargetDictionary;
        if (!morphDict) return;

        for (const [name, index] of Object.entries(morphDict)) {
            if (!this.state.morphTargets[name]) {
                this.state.morphTargets[name] = [];
            }
            this.state.morphTargets[name].push({ mesh, index });
        }
    }

    applyMorph(name, value) {
        const targets = this.state.morphTargets[name];
        if (!targets) {
            // Try case-insensitive
            const lowerName = name.toLowerCase();
            for (const [key, val] of Object.entries(this.state.morphTargets)) {
                if (key.toLowerCase() === lowerName) {
                    for (const t of val) {
                        t.mesh.morphTargetInfluences[t.index] = value;
                    }
                    return;
                }
            }
            return;
        }

        for (const t of targets) {
            t.mesh.morphTargetInfluences[t.index] = value;
        }
    }

    applyBodyMorphs(model) {
        const isFemale = this.state.gender === 'female';

        model.traverse((child) => {
            if (child.isMesh && child.morphTargetDictionary && child.morphTargetInfluences) {
                const morphDict = child.morphTargetDictionary;

                const femaleMorphs = ['female', 'Female', 'fullbody-female', 'feminine'];
                const maleMorphs = ['male', 'Male', 'fullbody-male', 'masculine'];

                for (const name of femaleMorphs) {
                    if (morphDict[name] !== undefined) {
                        child.morphTargetInfluences[morphDict[name]] = isFemale ? 1.0 : 0.0;
                    }
                }

                for (const name of maleMorphs) {
                    if (morphDict[name] !== undefined) {
                        child.morphTargetInfluences[morphDict[name]] = isFemale ? 0.0 : 1.0;
                    }
                }
            }
        });
    }

    // ==================== VISIBILITY ====================

    hideBuiltInHair() {
        for (const [name, mesh] of Object.entries(this.state.meshes)) {
            if (name.toLowerCase().includes('hair')) {
                mesh.visible = false;
            }
        }
    }

    hideBuiltInBeard() {
        for (const [name, mesh] of Object.entries(this.state.meshes)) {
            if (name.toLowerCase().includes('beard') || name.toLowerCase().includes('facialh')) {
                mesh.visible = false;
            }
        }
    }

    hideBody() {
        if (!this.state.avatar) return;
        this.state.avatar.traverse((child) => {
            if (child.isMesh) {
                const name = child.name.toLowerCase();
                if (name.includes('body') || name.includes('wolf3d_body') || name.includes('wolf3d_skin')) {
                    child.visible = false;
                }
            }
        });
    }

    showBody() {
        if (!this.state.avatar) return;
        this.state.avatar.traverse((child) => {
            if (child.isMesh) {
                const name = child.name.toLowerCase();
                if (name.includes('body') || name.includes('wolf3d_body') || name.includes('wolf3d_skin')) {
                    child.visible = true;
                }
            }
        });
    }

    hasClothingEquipped() {
        return this.state.assets.outfit ||
               this.state.assets.top ||
               this.state.assets.bottom ||
               this.state.assets.footwear;
    }

    updateBodyVisibility() {
        if (this.hasClothingEquipped()) {
            this.hideBody();
        } else {
            this.showBody();
        }
    }

    // ==================== COLORS ====================

    setHairColor(hexColor) {
        this.hairColor = new THREE.Color(hexColor);
        const asset = this.state.assets.hair;
        if (asset && asset.model) {
            asset.model.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.color = this.hairColor.clone();
                    child.material.needsUpdate = true;
                }
            });
        }
    }

    setBeardColor(hexColor) {
        this.beardColor = new THREE.Color(hexColor);
        const asset = this.state.assets.beard;
        if (asset && asset.model) {
            asset.model.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.color = this.beardColor.clone();
                    child.material.needsUpdate = true;
                }
            });
        }
    }

    setSkinColor(hexColor) {
        this.skinColor = new THREE.Color(hexColor);

        // Update base avatar
        if (this.state.avatar) {
            this.applySkinColorToModel(this.state.avatar);
        }

        // Update clothing
        for (const category of ['outfit', 'top', 'bottom', 'footwear']) {
            const asset = this.state.assets[category];
            if (asset && asset.model) {
                this.applySkinColorToModel(asset.model);
            }
        }
    }

    applySkinColorToModel(model) {
        model.traverse((child) => {
            if (child.isMesh) {
                const meshMatch = this.isSkinMesh(child.name);
                const materialMatch = child.material && this.isSkinMaterial(child.material);

                if (meshMatch || materialMatch) {
                    if (child.material) {
                        child.material.color = this.skinColor.clone();
                        child.material.needsUpdate = true;
                    }
                }
            }
        });
    }

    isSkinMaterial(material) {
        if (!material || !material.name) return false;
        const lower = material.name.toLowerCase();
        return lower.includes('skin') ||
               lower.includes('body') ||
               lower.includes('wolf3d_skin') ||
               lower.includes('wolf3d_body');
    }

    isSkinMesh(name) {
        const lower = name.toLowerCase();
        return lower.includes('skin') ||
               lower.includes('body') ||
               lower.includes('head') ||
               lower.includes('arm') ||
               lower.includes('hand') ||
               lower.includes('leg') ||
               lower.includes('foot') ||
               lower.includes('wolf3d_body') ||
               lower.includes('wolf3d_head');
    }

    getHairColor() { return '#' + this.hairColor.getHexString(); }
    getBeardColor() { return '#' + this.beardColor.getHexString(); }
    getSkinColor() { return '#' + this.skinColor.getHexString(); }

    // ==================== TEXTURE LOADING ====================

    async loadTexture(category, textureName) {
        const texturePath = `${this.basePath}/assets/${category}/${textureName}/texture.png`;

        try {
            const texture = await this.loadTextureFile(texturePath);

            for (const [name, mesh] of Object.entries(this.state.meshes)) {
                const nameLower = name.toLowerCase();
                if (category === 'eye' && nameLower.includes('eye') && !nameLower.includes('brow')) {
                    if (mesh.material) {
                        mesh.material.map = texture;
                        mesh.material.needsUpdate = true;
                    }
                } else if (category === 'eyebrows' && nameLower.includes('brow')) {
                    if (mesh.material) {
                        mesh.material.map = texture;
                        mesh.material.needsUpdate = true;
                    }
                }
            }
        } catch (error) {
            console.warn(`Failed to load texture: ${texturePath}`);
        }
    }

    loadTextureFile(path) {
        return new Promise((resolve, reject) => {
            const loader = new THREE.TextureLoader();
            loader.load(
                path,
                (texture) => {
                    texture.colorSpace = THREE.SRGBColorSpace;
                    texture.flipY = false;
                    resolve(texture);
                },
                undefined,
                reject
            );
        });
    }

    // ==================== UTILITIES ====================

    loadGLTF(path) {
        return new Promise((resolve, reject) => {
            this.loader.load(path, resolve, undefined, reject);
        });
    }

    disposeObject(object) {
        object.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => this.disposeMaterial(m));
                    } else {
                        this.disposeMaterial(child.material);
                    }
                }
            }
        });
    }

    disposeMaterial(material) {
        if (material.map) material.map.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.roughnessMap) material.roughnessMap.dispose();
        if (material.metalnessMap) material.metalnessMap.dispose();
        if (material.alphaMap) material.alphaMap.dispose();
        material.dispose();
    }

    // ==================== GETTERS (for compatibility) ====================

    getModel() { return this.state.avatar; }
    getGender() { return this.state.gender; }
    get currentGender() { return this.state.gender; }
    get currentAvatar() { return this.state.avatar; }
    get loadedAssets() { return this.state.assets; }
    get meshes() { return this.state.meshes; }
    get morphTargets() { return this.state.morphTargets; }

    getMeshNames() { return Object.keys(this.state.meshes); }
    getMorphTargetNames() { return Object.keys(this.state.morphTargets); }
    getBoneNames() { return Object.keys(this.state.bones); }
}
