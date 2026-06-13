import * as THREE from "three";
import { useEffect, useRef } from "react";

type ThreeDessertProps = {
  variant?: "bean" | "lost";
};

export function ThreeDessert({ variant = "bean" }: ThreeDessertProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.z = variant === "lost" ? 7.2 : 6;
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    host.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const chocolate = new THREE.MeshPhysicalMaterial({
      color: variant === "lost" ? 0x5c1716 : 0x4a1712,
      roughness: 0.3,
      metalness: 0.02,
      clearcoat: 0.55,
      clearcoatRoughness: 0.28,
    });
    const accent = new THREE.MeshPhysicalMaterial({
      color: variant === "lost" ? 0xe14462 : 0xe9a45c,
      roughness: 0.4,
      clearcoat: 0.25,
    });

    if (variant === "bean") {
      const bean = new THREE.Mesh(
        new THREE.SphereGeometry(1.15, 56, 38),
        chocolate,
      );
      bean.scale.set(0.78, 1.18, 0.56);
      bean.rotation.z = -0.45;
      group.add(bean);

      const seamCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.18, -1.05, 0.52),
        new THREE.Vector3(0.04, -0.45, 0.62),
        new THREE.Vector3(-0.1, 0.18, 0.64),
        new THREE.Vector3(0.18, 1.02, 0.48),
      ]);
      const seam = new THREE.Mesh(
        new THREE.TubeGeometry(seamCurve, 48, 0.035, 8, false),
        accent,
      );
      seam.rotation.z = -0.45;
      group.add(seam);
    } else {
      const cake = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.3, 1.25, 48),
        chocolate,
      );
      cake.rotation.z = 1.12;
      group.add(cake);
      const frosting = new THREE.Mesh(
        new THREE.SphereGeometry(1.18, 48, 28, 0, Math.PI * 2, 0, Math.PI / 2),
        accent,
      );
      frosting.scale.y = 0.5;
      frosting.position.set(-0.4, 0.7, 0);
      frosting.rotation.z = 1.12;
      group.add(frosting);
      const drop = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 24, 18),
        accent,
      );
      drop.scale.set(0.7, 1.6, 0.7);
      drop.position.set(1.2, -1.1, 0.25);
      group.add(drop);
    }

    scene.add(new THREE.HemisphereLight(0xffeee4, 0x2a0908, 2.8));
    const key = new THREE.DirectionalLight(0xffd7b3, 4.5);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.PointLight(0xf04e72, 14, 12);
    rim.position.set(-3, 1, 3);
    scene.add(rim);

    let dragging = false;
    let previousX = 0;
    let previousY = 0;
    let velocityX = 0.008;
    let velocityY = 0.014;
    let frame = 0;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
      camera.aspect = rect.width / Math.max(1, rect.height);
      camera.updateProjectionMatrix();
    };
    const onDown = (event: PointerEvent) => {
      dragging = true;
      previousX = event.clientX;
      previousY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (!dragging) return;
      velocityY = (event.clientX - previousX) * 0.008;
      velocityX = (event.clientY - previousY) * 0.008;
      group.rotation.y += velocityY;
      group.rotation.x += velocityX;
      previousX = event.clientX;
      previousY = event.clientY;
    };
    const onUp = () => {
      dragging = false;
    };
    const render = () => {
      frame = window.requestAnimationFrame(render);
      if (!dragging) {
        group.rotation.x += velocityX;
        group.rotation.y += velocityY;
        velocityX *= 0.985;
        velocityY *= 0.985;
        velocityY += (0.006 - velocityY) * 0.006;
      }
      group.position.y = Math.sin(performance.now() * 0.0018) * 0.08;
      renderer.render(scene, camera);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointercancel", onUp);
    resize();
    render();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointercancel", onUp);
      group.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      chocolate.dispose();
      accent.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [variant]);

  return <div className={`three-dessert three-dessert-${variant}`} ref={hostRef} />;
}
