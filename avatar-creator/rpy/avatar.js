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

        // Currently loaded assets (attached to head)
        this.loadedAssets = {
            hair: null,
            beard: null,
            glasses: null
        };

        // Head bone reference for attaching assets
        this.headBone = null;

        // Current colors for hair/beard
        this.hairColor = new THREE.Color(0x3d2314); // Default brown
        this.beardColor = new THREE.Color(0x3d2314);

        this.basePath = '../rpm_library';
    }

    async loadAvatar(avatarName) {
        console.log(`Loading avatar: ${avatarName}`);

        // Remove existing avatar
        if (this.currentAvatar) {
            this.scene.remove(this.currentAvatar);
            this.disposeObject(this.currentAvatar);
            this.currentAvatar = null;
            this.morphTargets = {};
            this.meshes = {};
            this.bones = {};
            this.headBone = null;
            this.loadedAssets = { hair: null, beard: null, glasses: null };
        }

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
                    // Find head bone
                    if (child.name === 'Head') {
                        this.headBone = child;
                        console.log('Found Head bone at:', child.getWorldPosition(new THREE.Vector3()));
                    }
                }
            });

            // Add to scene
            this.scene.add(this.currentAvatar);

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
     * Load and attach a raw asset to the head bone
     */
    async loadAsset(category, assetName) {
        console.log(`Loading ${category} asset: ${assetName}`);

        // Remove existing asset of this category
        this.removeAsset(category);

        if (assetName === 'none') {
            return;
        }

        if (!this.headBone) {
            console.error('No head bone found - cannot attach asset');
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

            // Calculate offset
            const headOffset = this.getAssetOffset(category, bounds);

            // Attach container to head bone
            this.headBone.add(container);

            // Position relative to head bone
            container.position.copy(headOffset);

            // Store reference
            this.loadedAssets[category] = {
                container: container,
                model: assetModel,
                name: assetName,
                texture: texture
            };

            console.log(`Attached ${category} "${assetName}" to head bone with offset: ${headOffset.x.toFixed(3)}, ${headOffset.y.toFixed(3)}, ${headOffset.z.toFixed(3)}`);

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

            default:
                break;
        }

        return offset;
    }

    /**
     * Remove attached asset
     */
    removeAsset(category) {
        const asset = this.loadedAssets[category];
        if (asset && asset.container) {
            // Remove from head bone
            if (this.headBone) {
                this.headBone.remove(asset.container);
            }
            // Dispose resources
            this.disposeObject(asset.container);
            this.loadedAssets[category] = null;
            console.log(`Removed ${category} asset`);
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
                (progress) => { },
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
