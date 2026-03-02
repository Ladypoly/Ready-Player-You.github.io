/**
 * Avatar Creator - Three.js Scene Management
 *
 * Handles 3D scene setup, camera, lighting, and rendering.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Scene3D {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.animationId = null;
    }

    async init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            throw new Error(`Container #${this.containerId} not found`);
        }

        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupLighting();
        this.setupControls();
        this.setupBackground();
        this.setupGroundPlane();
        this.setupParticles();

        // Handle resize
        window.addEventListener('resize', () => this.onResize());

        // Start render loop
        this.animate();

        console.log('Scene initialized');
    }

    setupScene() {
        this.scene = new THREE.Scene();
    }

    setupCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 100);
        this.camera.position.set(0, 1.5, 2.5);
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        // Cinematic tone mapping
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.3;

        // High quality shadows
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Enable physically correct lighting
        this.renderer.useLegacyLights = false;

        this.container.appendChild(this.renderer.domElement);
    }

    setupLighting() {
        // ============================================
        // CINEMATIC 3-POINT LIGHTING SETUP (BRIGHT)
        // ============================================

        // Hemisphere light for natural sky/ground ambient
        const hemi = new THREE.HemisphereLight(0xffeedd, 0x8888aa, 0.6);
        this.scene.add(hemi);

        // Soft ambient fill
        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambient);

        // ---- KEY LIGHT ----
        // Main light source, warm tone, positioned 45° right and above
        const keyLight = new THREE.DirectionalLight(0xfff8f0, 2.0);
        keyLight.position.set(3, 4, 3);
        keyLight.target.position.set(0, 1.2, 0);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 2048;
        keyLight.shadow.mapSize.height = 2048;
        keyLight.shadow.camera.near = 0.5;
        keyLight.shadow.camera.far = 15;
        keyLight.shadow.camera.left = -3;
        keyLight.shadow.camera.right = 3;
        keyLight.shadow.camera.top = 3;
        keyLight.shadow.camera.bottom = -3;
        keyLight.shadow.bias = -0.0001;
        keyLight.shadow.radius = 4;
        this.scene.add(keyLight);
        this.scene.add(keyLight.target);

        // ---- FILL LIGHT ----
        // Softer, cooler light from opposite side to fill shadows
        const fillLight = new THREE.DirectionalLight(0xd4e4ff, 0.8);
        fillLight.position.set(-3, 2, 2);
        fillLight.target.position.set(0, 1.2, 0);
        this.scene.add(fillLight);
        this.scene.add(fillLight.target);

        // ---- RIM LIGHT (Back Light) ----
        // Strong edge light from behind for silhouette separation
        const rimLight = new THREE.DirectionalLight(0xff6b9d, 1.2);
        rimLight.position.set(-1, 3, -3);
        rimLight.target.position.set(0, 1.2, 0);
        this.scene.add(rimLight);
        this.scene.add(rimLight.target);

        // ---- SECONDARY RIM (Accent) ----
        // Blue accent rim from other side for color contrast
        const accentRim = new THREE.DirectionalLight(0x4da6ff, 1.0);
        accentRim.position.set(2, 2, -2.5);
        accentRim.target.position.set(0, 1.2, 0);
        this.scene.add(accentRim);
        this.scene.add(accentRim.target);

        // ---- FRONT FILL ----
        // Additional front fill to brighten face
        const frontFill = new THREE.DirectionalLight(0xffffff, 0.5);
        frontFill.position.set(0, 2, 4);
        frontFill.target.position.set(0, 1.2, 0);
        this.scene.add(frontFill);
        this.scene.add(frontFill.target);

        // ---- TOP HAIR LIGHT ----
        // Overhead light to catch hair highlights
        const hairLight = new THREE.SpotLight(0xffffff, 1.0, 10, Math.PI / 5, 0.5, 1);
        hairLight.position.set(0, 4, 0.5);
        hairLight.target.position.set(0, 1.6, 0);
        this.scene.add(hairLight);
        this.scene.add(hairLight.target);
    }

    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 1.4, 0);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 1;
        this.controls.maxDistance = 5;
        this.controls.minPolarAngle = Math.PI / 4;
        this.controls.maxPolarAngle = Math.PI / 1.5;
        this.controls.update();

        // Viewport control buttons
        document.getElementById('resetViewBtn')?.addEventListener('click', () => this.resetView());
        document.getElementById('zoomInBtn')?.addEventListener('click', () => this.zoom(-0.3));
        document.getElementById('zoomOutBtn')?.addEventListener('click', () => this.zoom(0.3));
    }

    setupBackground() {
        // High-res gradient background
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');

        // Smooth radial gradient
        const radialGradient = ctx.createRadialGradient(512, 400, 0, 512, 512, 700);
        radialGradient.addColorStop(0, '#2a2a3a');
        radialGradient.addColorStop(0.4, '#1e1e2a');
        radialGradient.addColorStop(0.7, '#151520');
        radialGradient.addColorStop(1, '#0c0c12');
        ctx.fillStyle = radialGradient;
        ctx.fillRect(0, 0, 1024, 1024);

        // Subtle color accents
        const pinkGlow = ctx.createRadialGradient(200, 300, 0, 200, 300, 350);
        pinkGlow.addColorStop(0, 'rgba(255, 107, 157, 0.1)');
        pinkGlow.addColorStop(1, 'rgba(255, 107, 157, 0)');
        ctx.fillStyle = pinkGlow;
        ctx.fillRect(0, 0, 1024, 1024);

        const blueGlow = ctx.createRadialGradient(850, 350, 0, 850, 350, 300);
        blueGlow.addColorStop(0, 'rgba(77, 166, 255, 0.08)');
        blueGlow.addColorStop(1, 'rgba(77, 166, 255, 0)');
        ctx.fillStyle = blueGlow;
        ctx.fillRect(0, 0, 1024, 1024);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        this.scene.background = texture;
    }

    setupGroundPlane() {
        // Ground plane
        const groundGeo = new THREE.CircleGeometry(3, 64);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a22,
            roughness: 0.8,
            metalness: 0.2,
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Blob shadow under avatar
        const shadowCanvas = document.createElement('canvas');
        shadowCanvas.width = 256;
        shadowCanvas.height = 256;
        const sCtx = shadowCanvas.getContext('2d');

        const shadowGradient = sCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
        shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
        shadowGradient.addColorStop(0.4, 'rgba(0, 0, 0, 0.3)');
        shadowGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.1)');
        shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        sCtx.fillStyle = shadowGradient;
        sCtx.fillRect(0, 0, 256, 256);

        const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
        const shadowMat = new THREE.MeshBasicMaterial({
            map: shadowTexture,
            transparent: true,
            depthWrite: false,
        });
        const shadowGeo = new THREE.PlaneGeometry(1.2, 1.2);
        const blobShadow = new THREE.Mesh(shadowGeo, shadowMat);
        blobShadow.rotation.x = -Math.PI / 2;
        blobShadow.position.y = 0.01;
        this.scene.add(blobShadow);
    }

    setupParticles() {
        const particleCount = 100;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);

        const colorPink = new THREE.Color(0xff6b9d);
        const colorBlue = new THREE.Color(0x4da6ff);
        const colorWhite = new THREE.Color(0xffffff);

        for (let i = 0; i < particleCount; i++) {
            // Random position in a cylinder around the avatar
            const angle = Math.random() * Math.PI * 2;
            const radius = 1.5 + Math.random() * 2;
            const height = Math.random() * 3;

            positions[i * 3] = Math.cos(angle) * radius;
            positions[i * 3 + 1] = height;
            positions[i * 3 + 2] = Math.sin(angle) * radius;

            // Random color - mix of pink, blue, and white
            const colorChoice = Math.random();
            let color;
            if (colorChoice < 0.3) {
                color = colorPink;
            } else if (colorChoice < 0.6) {
                color = colorBlue;
            } else {
                color = colorWhite;
            }
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;

            // Random size
            sizes[i] = 0.02 + Math.random() * 0.04;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        // Create particle texture
        const particleCanvas = document.createElement('canvas');
        particleCanvas.width = 64;
        particleCanvas.height = 64;
        const pCtx = particleCanvas.getContext('2d');
        const particleGradient = pCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
        particleGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        particleGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
        particleGradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)');
        particleGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        pCtx.fillStyle = particleGradient;
        pCtx.fillRect(0, 0, 64, 64);

        const particleTexture = new THREE.CanvasTexture(particleCanvas);

        const material = new THREE.PointsMaterial({
            size: 0.05,
            map: particleTexture,
            vertexColors: true,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);

        // Store for animation
        this.particleData = {
            positions: positions,
            initialPositions: positions.slice(),
            time: 0
        };
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        // Animate particles
        if (this.particles && this.particleData) {
            this.particleData.time += 0.005;
            const positions = this.particles.geometry.attributes.position.array;
            const initial = this.particleData.initialPositions;

            for (let i = 0; i < positions.length / 3; i++) {
                const i3 = i * 3;
                // Gentle floating motion
                positions[i3] = initial[i3] + Math.sin(this.particleData.time + i * 0.5) * 0.1;
                positions[i3 + 1] = initial[i3 + 1] + Math.sin(this.particleData.time * 0.7 + i * 0.3) * 0.15;
                positions[i3 + 2] = initial[i3 + 2] + Math.cos(this.particleData.time + i * 0.4) * 0.1;
            }
            this.particles.geometry.attributes.position.needsUpdate = true;

            // Slow rotation
            this.particles.rotation.y += 0.0003;
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        if (!this.container) return;

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    resetView() {
        this.camera.position.set(0, 1.5, 2.5);
        this.controls.target.set(0, 1.4, 0);
        this.controls.update();
    }

    zoom(delta) {
        const direction = new THREE.Vector3();
        direction.subVectors(this.camera.position, this.controls.target).normalize();
        this.camera.position.addScaledVector(direction, delta);
        this.controls.update();
    }

    add(object) {
        this.scene.add(object);
    }

    remove(object) {
        this.scene.remove(object);
    }

    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.renderer.dispose();
        this.controls.dispose();
    }
}
