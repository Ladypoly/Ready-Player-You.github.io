/**
 * Avatar Creator - Avatar Management
 *
 * Hybrid approach:
 * - Uses complete avatar GLBs as base (proper body rigging)
 * - Attaches raw hair/beard/glasses assets to head bone
 * - Supports morph targets for face customization
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class AvatarManager {
    constructor(scene, catalog) {
        this.scene = scene;
        this.catalog = catalog;
        this.loader = new GLTFLoader();

        this.currentAvatar = null;
        this.currentGender = null;
        this.morphTargets = {};
        this.meshes = {};
        this.bones = {};

        // Currently loaded assets
        this.loadedAssets = {
            hair: null,
            beard: null,
            glasses: null,
            top: null,
            bottom: null,
            footwear: null,
            outfit: null,
            facewear: null,
            headwear: null,
            facemask: null
        };

        // Bone references for attaching assets
        this.headBone = null;
        this.hipsBone = null;

        // Current colors for hair/beard
        this.hairColor = new THREE.Color(0x3d2314); // Default brown
        this.beardColor = new THREE.Color(0x3d2314);

        // Skin color
        this.skinColor = new THREE.Color(0xc68642); // Default medium skin tone

        this.basePath = '../rpm_library';
    }

    async loadAvatar(avatarName) {
        console.log(`Loading avatar: ${avatarName}`);

        // Remove all loaded assets first
        this.clearAllAssets();

        // Remove existing avatar
        if (this.currentAvatar) {
            console.log('Removing existing avatar from scene');
            this.scene.scene.remove(this.currentAvatar);
            this.disposeObject(this.currentAvatar);
            this.currentAvatar = null;
        }

        // Reset all state
        this.morphTargets = {};
        this.meshes = {};
        this.bones = {};
        this.headBone = null;
        this.hipsBone = null;

        const path = `${this.basePath}/avatars/${avatarName}.glb`;

        try {
            const gltf = await this.loadGLTF(path);
            this.currentAvatar = gltf.scene;

            // Setup avatar
            this.currentAvatar.position.set(0, 0, 0);
            this.currentAvatar.scale.set(1, 1, 1);

            // Index all meshes, bones, and morph targets
            this.currentAvatar.traverse((child) => {
                if (child.isMesh) {
                    this.meshes[child.name] = child;
                    child.castShadow = true;
                    child.receiveShadow = true;

                    if (child.morphTargetInfluences && child.morphTargetDictionary) {
                        this.indexMorphTargets(child);
                    }
                }

                if (child.isBone) {
                    this.bones[child.name] = child;
                    // Find key bones
                    if (child.name === 'Head') {
                        this.headBone = child;
                        console.log('Found Head bone at:', child.getWorldPosition(new THREE.Vector3()));
                    }
                    if (child.name === 'Hips') {
                        this.hipsBone = child;
                        console.log('Found Hips bone at:', child.getWorldPosition(new THREE.Vector3()));
                    }
                }
            });

            // Add to scene
            this.scene.scene.add(this.currentAvatar);

            // Determine gender from name
            this.currentGender = avatarName.includes('female') ? 'female' : 'male';

            // Hide built-in hair and beard (we'll use raw assets instead)
            this.hideBuiltInHair();
            this.hideBuiltInBeard();

            console.log(`Loaded avatar with ${Object.keys(this.meshes).length} meshes, ${Object.keys(this.bones).length} bones`);
            console.log('Available bones:', Object.keys(this.bones).join(', '));

            return this.currentAvatar;
        } catch (error) {
            console.error('Failed to load avatar:', error);
            throw error;
        }
    }

    async loadBase(gender) {
        const avatarName = gender === 'female' ? 'female_default' : 'male_default';
        return this.loadAvatar(avatarName);
    }

    indexMorphTargets(mesh) {
        const morphDict = mesh.morphTargetDictionary;
        if (!morphDict) return;

        for (const [name, index] of Object.entries(morphDict)) {
            if (!this.morphTargets[name]) {
                this.morphTargets[name] = [];
            }
            this.morphTargets[name].push({
                mesh: mesh,
                index: index
            });
        }
    }

    applyMorph(name, value) {
        const targets = this.morphTargets[name];
        if (!targets) {
            // Try case-insensitive match
            const lowerName = name.toLowerCase();
            for (const [key, val] of Object.entries(this.morphTargets)) {
                if (key.toLowerCase() === lowerName) {
                    for (const target of val) {
                        target.mesh.morphTargetInfluences[target.index] = value;
                    }
                    return;
                }
            }
            console.warn(`Morph target "${name}" not found`);
            return;
        }

        for (const target of targets) {
            target.mesh.morphTargetInfluences[target.index] = value;
        }
    }

    resetMorphs() {
        for (const name in this.morphTargets) {
            this.applyMorph(name, 0);
        }
    }

    // Hide built-in meshes from complete avatar
    hideBuiltInHair() {
        for (const [name, mesh] of Object.entries(this.meshes)) {
            if (name.toLowerCase().includes('hair')) {
                mesh.visible = false;
            }
        }
    }

    hideBuiltInBeard() {
        for (const [name, mesh] of Object.entries(this.meshes)) {
            if (name.toLowerCase().includes('beard') || name.toLowerCase().includes('facialh')) {
                mesh.visible = false;
            }
        }
    }

    /**
     * Determine attachment type for asset category
     */
    getAttachmentType(category) {
        // Head-attached assets
        if (['hair', 'beard', 'glasses', 'facewear', 'headwear', 'facemask'].includes(category)) {
            return 'head';
        }
        // Body assets - attach to avatar root (they have full body positioning)
        if (['top', 'bottom', 'footwear', 'outfit'].includes(category)) {
            return 'root';
        }
        return 'head'; // default
    }

    /**
     * Load and attach a raw asset
     */
    async loadAsset(category, assetName) {
        console.log(`Loading ${category} asset: ${assetName}`);

        // Remove existing asset of this category
        this.removeAsset(category);

        if (assetName === 'none') {
            return;
        }

        // Mutual exclusion: outfit vs individual clothing
        if (category === 'outfit') {
            // Loading an outfit clears individual pieces
            this.clearIndividualClothing();
        } else if (['top', 'bottom', 'footwear'].includes(category)) {
            // Loading individual piece clears any outfit
            this.clearOutfit();
        }

        const attachType = this.getAttachmentType(category);

        if (attachType === 'head' && !this.headBone) {
            console.error('No head bone found - cannot attach head asset');
            return;
        }

        const assetFolder = `${this.basePath}/assets/${category}/${assetName}`;
        const assetPath = `${assetFolder}/model.glb`;
        const texturePath = `${assetFolder}/texture.png`;
        const maskPath = `${assetFolder}/mask.png`;

        try {
            // Determine what to load based on category
            const isHairOrBeard = (category === 'hair' || category === 'beard');

            // Load model and appropriate texture in parallel
            const loadPromises = [this.loadGLTF(assetPath)];

            if (isHairOrBeard) {
                // Hair/beard use mask.png for alpha, color is applied separately
                loadPromises.push(this.loadTextureFile(maskPath).catch(() => null));
            } else {
                // Other assets use texture.png
                loadPromises.push(this.loadTextureFile(texturePath).catch(() => null));
            }

            const [gltf, texture] = await Promise.all(loadPromises);

            const assetModel = gltf.scene;

            // Get head bone world position
            const headWorldPos = new THREE.Vector3();
            this.headBone.getWorldPosition(headWorldPos);
            console.log(`Head bone world position: ${headWorldPos.x.toFixed(3)}, ${headWorldPos.y.toFixed(3)}, ${headWorldPos.z.toFixed(3)}`);

            // Analyze the asset geometry to find its bounds
            const bounds = this.getAssetBounds(assetModel);
            console.log(`Asset bounds: Y min=${bounds.min.y.toFixed(3)}, max=${bounds.max.y.toFixed(3)}, center=${bounds.center.y.toFixed(3)}`);

            // Create a container for the asset
            const container = new THREE.Group();
            container.name = `${category}_container`;

            // Get the color for hair/beard
            const assetColor = category === 'hair' ? this.hairColor :
                               category === 'beard' ? this.beardColor : null;

            // Add asset to container and apply texture/color
            assetModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    if (child.material) {
                        if (isHairOrBeard) {
                            // For hair/beard: apply color and use mask for alpha
                            child.material.color = assetColor.clone();

                            if (texture) {
                                // Use mask as alpha map
                                child.material.alphaMap = texture;
                                child.material.transparent = true;
                                child.material.alphaTest = 0.5;
                            }

                            console.log(`Applied color ${assetColor.getHexString()} to ${child.name}`);
                        } else if (texture) {
                            // For other assets: apply texture directly
                            child.material.map = texture;
                            console.log(`Applied texture to ${child.name}`);
                        }

                        child.material.needsUpdate = true;
                    }
                }
            });
            container.add(assetModel);

            // Apply body shape morphs for clothing
            if (['outfit', 'top', 'bottom', 'footwear'].includes(category)) {
                this.applyBodyMorphs(assetModel);

                // Apply skin color to skin meshes in outfit
                assetModel.traverse((child) => {
                    if (child.isMesh && this.isSkinMesh(child.name)) {
                        if (child.material) {
                            child.material.color = this.skinColor.clone();
                            child.material.needsUpdate = true;
                            console.log(`Applied skin color to ${child.name}`);
                        }
                    }
                });
            }

            // Attach based on category type
            if (attachType === 'head') {
                // Calculate offset for head-attached items
                const headOffset = this.getAssetOffset(category, bounds);
                this.headBone.add(container);
                container.position.copy(headOffset);
                console.log(`Attached ${category} "${assetName}" to head bone with offset: ${headOffset.x.toFixed(3)}, ${headOffset.y.toFixed(3)}, ${headOffset.z.toFixed(3)}`);
            } else {
                // Body assets - add to avatar root at origin (they already have correct positioning)
                this.currentAvatar.add(container);
                container.position.set(0, 0, 0);
                console.log(`Attached ${category} "${assetName}" to avatar root`);
            }

            // Store reference
            this.loadedAssets[category] = {
                container: container,
                model: assetModel,
                name: assetName,
                texture: texture,
                attachType: attachType
            };

            // Update body visibility when clothing is equipped
            if (['outfit', 'top', 'bottom', 'footwear'].includes(category)) {
                this.updateBodyVisibility();
            }

        } catch (error) {
            console.error(`Failed to load asset ${assetPath}:`, error);
        }
    }

    /**
     * Load a texture file
     */
    loadTextureFile(path) {
        return new Promise((resolve, reject) => {
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(
                path,
                (texture) => {
                    texture.colorSpace = THREE.SRGBColorSpace;
                    texture.flipY = false;
                    resolve(texture);
                },
                undefined,
                (error) => reject(error)
            );
        });
    }

    /**
     * Calculate bounding box of asset
     */
    getAssetBounds(model) {
        const box = new THREE.Box3().setFromObject(model);
        return {
            min: box.min,
            max: box.max,
            center: box.getCenter(new THREE.Vector3()),
            size: box.getSize(new THREE.Vector3())
        };
    }

    /**
     * Get positioning offset for different asset types
     * Uses debug offsets if available, otherwise tuned defaults
     */
    getAssetOffset(category, bounds) {
        const offset = new THREE.Vector3(0, 0, 0);

        // Check for debug offsets first (set via debug panel)
        if (this.debugOffsets && this.debugOffsets[category]) {
            offset.x = this.debugOffsets[category].x || 0;
            offset.y = this.debugOffsets[category].y || 0;
            offset.z = this.debugOffsets[category].z || 0;
            return offset;
        }

        // Tuned offsets for male and female avatars
        const isFemale = this.currentGender === 'female';

        switch (category) {
            case 'hair':
                if (isFemale) {
                    offset.x = 0.00;
                    offset.y = -0.10;
                    offset.z = 0.01;
                } else {
                    offset.x = 0.00;
                    offset.y = -0.08;
                    offset.z = 0.02;
                }
                break;

            case 'beard':
                // Same for both genders
                offset.x = 0.00;
                offset.y = -0.09;
                offset.z = 0.03;
                break;

            case 'glasses':
                if (isFemale) {
                    offset.x = 0.00;
                    offset.y = -0.08;
                    offset.z = 0.02;
                } else {
                    offset.x = 0.00;
                    offset.y = -0.08;
                    offset.z = 0.03;
                }
                break;

            case 'headwear':
                // Hats sit on top of head
                offset.x = 0.00;
                offset.y = -0.08;
                offset.z = 0.00;
                break;

            case 'facewear':
            case 'facemask':
                // Face attachments (masks, bandanas, makeup)
                offset.x = 0.00;
                offset.y = -0.08;
                offset.z = 0.02;
                break;

            default:
                break;
        }

        return offset;
    }

    /**
     * Hide base avatar body mesh (used when clothing is equipped)
     * Clothing assets include their own skin meshes
     */
    hideBody() {
        if (!this.currentAvatar) return;

        this.currentAvatar.traverse((child) => {
            if (child.isMesh) {
                const name = child.name.toLowerCase();
                // Hide body mesh but keep head, eyes, teeth
                if (name.includes('body') || name.includes('wolf3d_body') || name.includes('wolf3d_skin')) {
                    child.visible = false;
                    console.log(`Hidden body mesh: ${child.name}`);
                }
            }
        });
    }

    /**
     * Show base avatar body mesh (used when all clothing is removed)
     */
    showBody() {
        if (!this.currentAvatar) return;

        this.currentAvatar.traverse((child) => {
            if (child.isMesh) {
                const name = child.name.toLowerCase();
                if (name.includes('body') || name.includes('wolf3d_body') || name.includes('wolf3d_skin')) {
                    child.visible = true;
                    console.log(`Shown body mesh: ${child.name}`);
                }
            }
        });
    }

    /**
     * Check if any clothing is currently equipped
     */
    hasClothingEquipped() {
        return this.loadedAssets.outfit ||
               this.loadedAssets.top ||
               this.loadedAssets.bottom ||
               this.loadedAssets.footwear;
    }

    /**
     * Update body visibility based on equipped clothing
     */
    updateBodyVisibility() {
        if (this.hasClothingEquipped()) {
            this.hideBody();
        } else {
            this.showBody();
        }
    }

    /**
     * Clear ALL loaded assets (used when switching avatars)
     */
    clearAllAssets() {
        const categories = ['hair', 'beard', 'glasses', 'top', 'bottom', 'footwear', 'outfit', 'facewear', 'headwear', 'facemask'];
        for (const category of categories) {
            if (this.loadedAssets[category]) {
                this.removeAsset(category);
            }
        }
        console.log('Cleared all assets');
    }

    /**
     * Clear individual clothing pieces (top, bottom, footwear)
     * Called when loading a full outfit to avoid visual stacking
     */
    clearIndividualClothing() {
        this.removeAsset('top');
        this.removeAsset('bottom');
        this.removeAsset('footwear');
    }

    /**
     * Clear outfit
     * Called when loading individual clothing pieces
     */
    clearOutfit() {
        this.removeAsset('outfit');
    }

    /**
     * Remove attached asset
     */
    removeAsset(category) {
        const asset = this.loadedAssets[category];
        if (asset && asset.container) {
            // Remove from parent based on attachment type
            if (asset.attachType === 'head' && this.headBone) {
                this.headBone.remove(asset.container);
            } else if (this.currentAvatar) {
                this.currentAvatar.remove(asset.container);
            }
            // Dispose resources
            this.disposeObject(asset.container);
            this.loadedAssets[category] = null;
            console.log(`Removed ${category} asset`);

            // Update body visibility when clothing is removed
            if (['outfit', 'top', 'bottom', 'footwear'].includes(category)) {
                this.updateBodyVisibility();
            }
        }
    }

    /**
     * Show/hide methods for compatibility
     */
    hideHair() {
        this.removeAsset('hair');
    }

    showHair() {
        // Re-show built-in hair if no custom hair loaded
        if (!this.loadedAssets.hair) {
            for (const [name, mesh] of Object.entries(this.meshes)) {
                if (name.toLowerCase().includes('hair')) {
                    mesh.visible = true;
                }
            }
        }
    }

    hideBeard() {
        this.removeAsset('beard');
    }

    showBeard() {
        if (!this.loadedAssets.beard) {
            for (const [name, mesh] of Object.entries(this.meshes)) {
                if (name.toLowerCase().includes('beard') || name.toLowerCase().includes('facialh')) {
                    mesh.visible = true;
                }
            }
        }
    }

    getMeshNames() {
        return Object.keys(this.meshes);
    }

    getMorphTargetNames() {
        return Object.keys(this.morphTargets);
    }

    getBoneNames() {
        return Object.keys(this.bones);
    }

    /**
     * Set hair color
     */
    setHairColor(hexColor) {
        this.hairColor = new THREE.Color(hexColor);

        // Update existing hair asset if loaded
        const hairAsset = this.loadedAssets.hair;
        if (hairAsset && hairAsset.model) {
            hairAsset.model.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.color = this.hairColor.clone();
                    child.material.needsUpdate = true;
                }
            });
        }

        console.log(`Hair color set to: ${this.hairColor.getHexString()}`);
    }

    /**
     * Set beard color
     */
    setBeardColor(hexColor) {
        this.beardColor = new THREE.Color(hexColor);

        // Update existing beard asset if loaded
        const beardAsset = this.loadedAssets.beard;
        if (beardAsset && beardAsset.model) {
            beardAsset.model.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.color = this.beardColor.clone();
                    child.material.needsUpdate = true;
                }
            });
        }

        console.log(`Beard color set to: ${this.beardColor.getHexString()}`);
    }

    /**
     * Get current hair color
     */
    getHairColor() {
        return '#' + this.hairColor.getHexString();
    }

    /**
     * Get current beard color
     */
    getBeardColor() {
        return '#' + this.beardColor.getHexString();
    }

    /**
     * Set skin color for avatar and all outfit skin meshes
     */
    setSkinColor(hexColor) {
        this.skinColor = new THREE.Color(hexColor);

        // Update base avatar skin meshes
        if (this.currentAvatar) {
            this.currentAvatar.traverse((child) => {
                if (child.isMesh && this.isSkinMesh(child.name)) {
                    if (child.material) {
                        child.material.color = this.skinColor.clone();
                        child.material.needsUpdate = true;
                    }
                }
            });
        }

        // Update skin meshes in loaded outfits/clothing
        for (const category of ['outfit', 'top', 'bottom', 'footwear']) {
            const asset = this.loadedAssets[category];
            if (asset && asset.model) {
                asset.model.traverse((child) => {
                    if (child.isMesh && this.isSkinMesh(child.name)) {
                        if (child.material) {
                            child.material.color = this.skinColor.clone();
                            child.material.needsUpdate = true;
                        }
                    }
                });
            }
        }

        console.log(`Skin color set to: ${this.skinColor.getHexString()}`);
    }

    /**
     * Get current skin color
     */
    getSkinColor() {
        return '#' + this.skinColor.getHexString();
    }

    /**
     * Check if a mesh is a skin mesh based on name
     */
    isSkinMesh(name) {
        const lower = name.toLowerCase();
        return lower.includes('skin') ||
               lower.includes('body') ||
               lower.includes('arm') ||
               lower.includes('hand') ||
               lower.includes('leg') ||
               lower.includes('foot') ||
               lower.includes('head') ||
               lower.includes('wolf3d_body') ||
               lower.includes('wolf3d_head');
    }

    /**
     * Apply body shape morph targets to a clothing asset
     */
    applyBodyMorphs(model) {
        const isFemale = this.currentGender === 'female';

        model.traverse((child) => {
            if (child.isMesh && child.morphTargetDictionary && child.morphTargetInfluences) {
                const morphDict = child.morphTargetDictionary;

                // Log available morphs for debugging
                console.log(`Morphs available on ${child.name}:`, Object.keys(morphDict));

                // Try various female body shape morph names
                const femaleMorphNames = [
                    'female', 'Female',
                    'fullbody-female', 'Fullbody-female',
                    'body_female', 'Body_Female',
                    'feminine', 'Feminine'
                ];

                for (const morphName of femaleMorphNames) {
                    if (morphDict[morphName] !== undefined) {
                        const index = morphDict[morphName];
                        child.morphTargetInfluences[index] = isFemale ? 1.0 : 0.0;
                        console.log(`Applied morph "${morphName}" = ${isFemale ? 1.0 : 0.0} on ${child.name}`);
                    }
                }

                // Also check for male morphs (set opposite)
                const maleMorphNames = [
                    'male', 'Male',
                    'fullbody-male', 'Fullbody-male',
                    'body_male', 'Body_Male',
                    'masculine', 'Masculine'
                ];

                for (const morphName of maleMorphNames) {
                    if (morphDict[morphName] !== undefined) {
                        const index = morphDict[morphName];
                        child.morphTargetInfluences[index] = isFemale ? 0.0 : 1.0;
                        console.log(`Applied morph "${morphName}" = ${isFemale ? 0.0 : 1.0} on ${child.name}`);
                    }
                }
            }
        });
    }

    async loadTexture(category, textureName) {
        const texturePath = `${this.basePath}/assets/${category}/${textureName}/texture.png`;

        try {
            const textureLoader = new THREE.TextureLoader();
            const texture = await new Promise((resolve, reject) => {
                textureLoader.load(texturePath, resolve, undefined, reject);
            });

            texture.colorSpace = THREE.SRGBColorSpace;
            texture.flipY = false;

            for (const [name, mesh] of Object.entries(this.meshes)) {
                const nameLower = name.toLowerCase();

                if (category === 'eye' && (nameLower.includes('eye') && !nameLower.includes('brow'))) {
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

            console.log(`Applied ${category} texture: ${textureName}`);
        } catch (error) {
            console.warn(`Failed to load texture ${texturePath}:`, error);
        }
    }

    loadGLTF(path) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                path,
                (gltf) => resolve(gltf),
                (progress) => {},
                (error) => reject(error)
            );
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
        material.dispose();
    }

    getModel() {
        return this.currentAvatar;
    }

    getGender() {
        return this.currentGender;
    }
}
