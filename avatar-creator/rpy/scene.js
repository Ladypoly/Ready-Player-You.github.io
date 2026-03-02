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
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.container.appendChild(this.renderer.domElement);
    }

    setupLighting() {
        // Ambient light
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);

        // Main key light
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
        keyLight.position.set(2, 3, 2);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        this.scene.add(keyLight);

        // Fill light
        const fillLight = new THREE.DirectionalLight(0xe93392, 0.3);
        fillLight.position.set(-2, 1, 2);
        this.scene.add(fillLight);

        // Rim light
        const rimLight = new THREE.DirectionalLight(0x1d77d6, 0.4);
        rimLight.position.set(0, 2, -2);
        this.scene.add(rimLight);
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
        // Gradient background using a plane
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(0.5, '#16162a');
        gradient.addColorStop(1, '#0d0d15');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 2, 512);

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
