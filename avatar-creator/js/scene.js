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
        this.renderer.toneMappingExposure = 1.1;

        // High quality shadows
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Enable physically correct lighting
        this.renderer.useLegacyLights = false;

        this.container.appendChild(this.renderer.domElement);
    }

    setupLighting() {
        // ============================================
        // CINEMATIC 3-POINT LIGHTING SETUP
        // ============================================

        // Soft ambient fill - very subtle to keep shadows dramatic
        const ambient = new THREE.AmbientLight(0x404050, 0.3);
        this.scene.add(ambient);

        // ---- KEY LIGHT ----
        // Main light source, warm tone, positioned 45° right and above
        const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
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
        keyLight.shadow.radius = 4; // Soft shadow edges
        this.scene.add(keyLight);
        this.scene.add(keyLight.target);

        // ---- FILL LIGHT ----
        // Softer, cooler light from opposite side to fill shadows
        const fillLight = new THREE.DirectionalLight(0xc4d4ff, 0.4);
        fillLight.position.set(-3, 2, 2);
        fillLight.target.position.set(0, 1.2, 0);
        this.scene.add(fillLight);
        this.scene.add(fillLight.target);

        // ---- RIM LIGHT (Back Light) ----
        // Strong edge light from behind for silhouette separation
        const rimLight = new THREE.DirectionalLight(0xff6b9d, 0.8);
        rimLight.position.set(-1, 3, -3);
        rimLight.target.position.set(0, 1.2, 0);
        this.scene.add(rimLight);
        this.scene.add(rimLight.target);

        // ---- SECONDARY RIM (Accent) ----
        // Blue accent rim from other side for color contrast
        const accentRim = new THREE.DirectionalLight(0x4da6ff, 0.6);
        accentRim.position.set(2, 2, -2.5);
        accentRim.target.position.set(0, 1.2, 0);
        this.scene.add(accentRim);
        this.scene.add(accentRim.target);

        // ---- GROUND BOUNCE ----
        // Subtle upward light simulating ground reflection
        const bounceLight = new THREE.DirectionalLight(0x8888aa, 0.15);
        bounceLight.position.set(0, -2, 1);
        bounceLight.target.position.set(0, 1, 0);
        this.scene.add(bounceLight);
        this.scene.add(bounceLight.target);

        // ---- TOP HAIR LIGHT ----
        // Subtle overhead light to catch hair highlights
        const hairLight = new THREE.SpotLight(0xffffff, 0.5, 10, Math.PI / 6, 0.5, 1);
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
        // Cinematic gradient background
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Radial gradient for depth - darker edges, subtle center glow
        const radialGradient = ctx.createRadialGradient(256, 200, 0, 256, 256, 400);
        radialGradient.addColorStop(0, '#252535');
        radialGradient.addColorStop(0.5, '#1a1a28');
        radialGradient.addColorStop(1, '#0a0a12');
        ctx.fillStyle = radialGradient;
        ctx.fillRect(0, 0, 512, 512);

        // Add subtle color accents matching rim lights
        const pinkGlow = ctx.createRadialGradient(100, 150, 0, 100, 150, 200);
        pinkGlow.addColorStop(0, 'rgba(255, 107, 157, 0.08)');
        pinkGlow.addColorStop(1, 'rgba(255, 107, 157, 0)');
        ctx.fillStyle = pinkGlow;
        ctx.fillRect(0, 0, 512, 512);

        const blueGlow = ctx.createRadialGradient(420, 180, 0, 420, 180, 180);
        blueGlow.addColorStop(0, 'rgba(77, 166, 255, 0.06)');
        blueGlow.addColorStop(1, 'rgba(77, 166, 255, 0)');
        ctx.fillStyle = blueGlow;
        ctx.fillRect(0, 0, 512, 512);

        const texture = new THREE.CanvasTexture(canvas);
        this.scene.background = texture;
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
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
