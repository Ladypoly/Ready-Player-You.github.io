/**
 * Avatar Creator - Export System
 *
 * Handles exporting avatars to GLB and VRM formats.
 */

import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export class Exporter {
    constructor(scene, avatar) {
        this.scene = scene;
        this.avatar = avatar;
        this.gltfExporter = new GLTFExporter();
    }

    async export(format, name) {
        console.log(`Exporting as ${format}: ${name}`);

        const model = this.avatar.getModel();
        if (!model) {
            throw new Error('No avatar loaded');
        }

        if (format === 'glb') {
            await this.exportGLB(model, name);
        } else if (format === 'vrm') {
            await this.exportVRM(model, name);
        }
    }

    async exportGLB(model, name) {
        const options = {
            binary: true,
            maxTextureSize: 1024,
            animations: [],
            includeCustomExtensions: true,
        };

        return new Promise((resolve, reject) => {
            this.gltfExporter.parse(
                model,
                (buffer) => {
                    this.downloadBlob(buffer, `${name}.glb`, 'model/gltf-binary');
                    console.log('GLB export complete');
                    resolve();
                },
                (error) => {
                    console.error('GLB export failed:', error);
                    reject(error);
                },
                options
            );
        });
    }

    async exportVRM(model, name) {
        // VRM is GLB with additional extensions
        // We'll create a basic VRM 0.x compatible file

        const options = {
            binary: true,
            maxTextureSize: 1024,
            animations: [],
            includeCustomExtensions: true,
        };

        return new Promise((resolve, reject) => {
            this.gltfExporter.parse(
                model,
                async (buffer) => {
                    try {
                        // Convert to VRM by adding VRM extensions
                        const vrmBuffer = await this.addVRMExtensions(buffer, name);
                        this.downloadBlob(vrmBuffer, `${name}.vrm`, 'model/gltf-binary');
                        console.log('VRM export complete');
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                },
                (error) => {
                    console.error('VRM export failed:', error);
                    reject(error);
                },
                options
            );
        });
    }

    async addVRMExtensions(glbBuffer, name) {
        // Parse GLB structure
        const dataView = new DataView(glbBuffer);

        // GLB Header (12 bytes)
        const magic = dataView.getUint32(0, true);
        const version = dataView.getUint32(4, true);
        const length = dataView.getUint32(8, true);

        if (magic !== 0x46546C67) { // 'glTF'
            throw new Error('Invalid GLB file');
        }

        // First chunk (JSON)
        const chunk0Length = dataView.getUint32(12, true);
        const chunk0Type = dataView.getUint32(16, true);

        if (chunk0Type !== 0x4E4F534A) { // 'JSON'
            throw new Error('First chunk is not JSON');
        }

        // Extract and parse JSON
        const jsonData = new Uint8Array(glbBuffer, 20, chunk0Length);
        const jsonString = new TextDecoder().decode(jsonData);
        const gltf = JSON.parse(jsonString);

        // Add VRM extension
        if (!gltf.extensionsUsed) {
            gltf.extensionsUsed = [];
        }
        gltf.extensionsUsed.push('VRM');

        if (!gltf.extensions) {
            gltf.extensions = {};
        }

        // VRM 0.x metadata
        gltf.extensions.VRM = {
            exporterVersion: 'AvatarCreator-1.0',
            specVersion: '0.0',
            meta: {
                title: name,
                version: '1.0',
                author: 'Avatar Creator',
                contactInformation: '',
                reference: '',
                texture: -1,
                allowedUserName: 'Everyone',
                violentUsageName: 'Disallow',
                sexualUsageName: 'Disallow',
                commercialUsageName: 'Allow',
                otherPermissionUrl: '',
                licenseName: 'CC0',
                otherLicenseUrl: ''
            },
            humanoid: this.createHumanoidBones(gltf),
            blendShapeMaster: this.createBlendShapeMaster(gltf),
            firstPerson: {
                firstPersonBone: this.findBoneIndex(gltf, 'Head'),
                firstPersonBoneOffset: { x: 0, y: 0.06, z: 0 },
                meshAnnotations: [],
                lookAtTypeName: 'Bone',
                lookAtHorizontalInner: { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 10 },
                lookAtHorizontalOuter: { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 10 },
                lookAtVerticalDown: { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 10 },
                lookAtVerticalUp: { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 10 }
            },
            materialProperties: []
        };

        // Rebuild GLB with modified JSON
        const newJsonString = JSON.stringify(gltf);
        const newJsonBytes = new TextEncoder().encode(newJsonString);

        // Pad to 4-byte boundary
        const paddedLength = Math.ceil(newJsonBytes.length / 4) * 4;
        const paddedJson = new Uint8Array(paddedLength);
        paddedJson.set(newJsonBytes);
        for (let i = newJsonBytes.length; i < paddedLength; i++) {
            paddedJson[i] = 0x20; // Space padding
        }

        // Get binary chunk if exists
        let binaryChunk = null;
        const binaryChunkOffset = 20 + chunk0Length;
        if (binaryChunkOffset < length) {
            const chunk1Length = dataView.getUint32(binaryChunkOffset, true);
            binaryChunk = new Uint8Array(glbBuffer, binaryChunkOffset + 8, chunk1Length);
        }

        // Calculate new total size
        const jsonChunkSize = 8 + paddedJson.length;
        const binaryChunkSize = binaryChunk ? 8 + binaryChunk.length : 0;
        const newLength = 12 + jsonChunkSize + binaryChunkSize;

        // Build new GLB
        const newBuffer = new ArrayBuffer(newLength);
        const newView = new DataView(newBuffer);
        const newArray = new Uint8Array(newBuffer);

        // Header
        newView.setUint32(0, 0x46546C67, true); // 'glTF'
        newView.setUint32(4, 2, true); // version
        newView.setUint32(8, newLength, true);

        // JSON chunk header
        newView.setUint32(12, paddedJson.length, true);
        newView.setUint32(16, 0x4E4F534A, true); // 'JSON'
        newArray.set(paddedJson, 20);

        // Binary chunk
        if (binaryChunk) {
            const binOffset = 20 + paddedJson.length;
            newView.setUint32(binOffset, binaryChunk.length, true);
            newView.setUint32(binOffset + 4, 0x004E4942, true); // 'BIN'
            newArray.set(binaryChunk, binOffset + 8);
        }

        return newBuffer;
    }

    createHumanoidBones(gltf) {
        // Map standard RPM bones to VRM humanoid bones
        const boneMapping = {
            'Hips': 'hips',
            'Spine': 'spine',
            'Spine1': 'chest',
            'Spine2': 'upperChest',
            'Neck': 'neck',
            'Head': 'head',
            'LeftShoulder': 'leftShoulder',
            'LeftArm': 'leftUpperArm',
            'LeftForeArm': 'leftLowerArm',
            'LeftHand': 'leftHand',
            'RightShoulder': 'rightShoulder',
            'RightArm': 'rightUpperArm',
            'RightForeArm': 'rightLowerArm',
            'RightHand': 'rightHand',
            'LeftUpLeg': 'leftUpperLeg',
            'LeftLeg': 'leftLowerLeg',
            'LeftFoot': 'leftFoot',
            'LeftToeBase': 'leftToes',
            'RightUpLeg': 'rightUpperLeg',
            'RightLeg': 'rightLowerLeg',
            'RightFoot': 'rightFoot',
            'RightToeBase': 'rightToes',
            'LeftEye': 'leftEye',
            'RightEye': 'rightEye',
        };

        const humanBones = [];

        if (gltf.nodes) {
            for (let i = 0; i < gltf.nodes.length; i++) {
                const node = gltf.nodes[i];
                const vrmBone = boneMapping[node.name];
                if (vrmBone) {
                    humanBones.push({
                        bone: vrmBone,
                        node: i,
                        useDefaultValues: true
                    });
                }
            }
        }

        return {
            humanBones: humanBones,
            armStretch: 0.05,
            legStretch: 0.05,
            upperArmTwist: 0.5,
            lowerArmTwist: 0.5,
            upperLegTwist: 0.5,
            lowerLegTwist: 0.5,
            feetSpacing: 0,
            hasTranslationDoF: false
        };
    }

    createBlendShapeMaster(gltf) {
        // Map RPM morph targets to VRM blend shape groups
        const blendShapeGroups = [];

        // Expression mappings
        const expressions = {
            'mouthSmile': 'joy',
            'eyesClosed': 'blink',
            'eyeBlinkLeft': 'blink_l',
            'eyeBlinkRight': 'blink_r',
            'mouthOpen': 'a',
            'viseme_E': 'e',
            'viseme_I': 'i',
            'viseme_O': 'o',
            'viseme_U': 'u',
        };

        // Find meshes with morph targets
        if (gltf.meshes) {
            for (let meshIndex = 0; meshIndex < gltf.meshes.length; meshIndex++) {
                const mesh = gltf.meshes[meshIndex];
                if (mesh.extras && mesh.extras.targetNames) {
                    for (let i = 0; i < mesh.extras.targetNames.length; i++) {
                        const targetName = mesh.extras.targetNames[i];
                        const presetName = expressions[targetName];

                        if (presetName) {
                            blendShapeGroups.push({
                                name: presetName,
                                presetName: presetName,
                                binds: [{
                                    mesh: meshIndex,
                                    index: i,
                                    weight: 100
                                }],
                                materialValues: [],
                                isBinary: false
                            });
                        }
                    }
                }
            }
        }

        return {
            blendShapeGroups: blendShapeGroups
        };
    }

    findBoneIndex(gltf, boneName) {
        if (!gltf.nodes) return -1;
        for (let i = 0; i < gltf.nodes.length; i++) {
            if (gltf.nodes[i].name === boneName) {
                return i;
            }
        }
        return -1;
    }

    downloadBlob(buffer, filename, mimeType) {
        const blob = new Blob([buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();

        URL.revokeObjectURL(url);
    }
}
