import { useI18n, localizeError } from './i18n';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { Stage } from '../runtime/stage';
import type { Project, Shot, Transform } from '../core/schema';
export type ViewportProps = {
  project: Project;
  shot: Shot;
  time: number;
  selection: string | null;
  mode: 'stage' | 'camera';
  tool: 'translate' | 'rotate' | 'scale';
  snap?: number;
  onThumbnails?: (images: Record<string, string>, revision: number) => void;
  onSelect: (id: string | null) => void;
  onTransform: (id: string, t: Transform, revision: number) => void;
  onCapture: (position: [number, number, number], target: [number, number, number]) => void;
};
export function Viewport(props: ViewportProps) {
  const { t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 500 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef(props);
  current.current = props;
  const runtime = useRef<{
    stage: Stage;
    orbit: OrbitControls;
    gizmo: TransformControls;
    bounds: THREE.BoxHelper;
    editor: THREE.PerspectiveCamera;
  } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!canvas.current) return;
    let stage: Stage;
    try {
      stage = new Stage(canvas.current);
    } catch (e) {
      setError(t('无法启动 WebGL：') + String(e));
      return;
    }
    const editor = new THREE.PerspectiveCamera(43, 1, 0.05, 200);
    editor.position.set(9, 7, 11);
    const orbit = new OrbitControls(editor, canvas.current);
    orbit.target.set(0, 1, 0);
    orbit.enableDamping = true;
    const gizmo = new TransformControls(editor, canvas.current);
    stage.scene.add(gizmo.getHelper());
    const bounds = new THREE.BoxHelper(new THREE.Object3D(), '#d3eb88');
    bounds.visible = false;
    stage.scene.add(bounds);
    let loaded = false,
      dragRevision = 0,
      pointer = new THREE.Vector2(),
      frame = 0;
    gizmo.addEventListener('dragging-changed', (e) => {
      orbit.enabled = !e.value && current.current.mode === 'stage';
      if (e.value) dragRevision = current.current.project.revision;
    });
    gizmo.addEventListener('mouseUp', () => {
      const object = gizmo.object;
      if (!object) return;
      current.current.onTransform(
        object.userData.entityId,
        {
          position: object.position.toArray(),
          rotation: object.quaternion.toArray(),
          scale: object.scale.toArray(),
        },
        dragRevision,
      );
    });
    const onDown = (e: PointerEvent) => pointer.set(e.clientX, e.clientY);
    const onUp = (e: PointerEvent) => {
      if (
        current.current.mode !== 'stage' ||
        gizmo.axis ||
        pointer.distanceTo(new THREE.Vector2(e.clientX, e.clientY)) > 4
      )
        return;
      const rect = canvas.current!.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        editor,
      );
      let object: THREE.Object3D | null =
        ray.intersectObjects([...stage.objects.values()], true)[0]?.object ?? null;
      while (object && !object.userData.entityId) object = object.parent;
      current.current.onSelect(object?.userData.entityId ?? null);
    };
    canvas.current.addEventListener('pointerdown', onDown);
    canvas.current.addEventListener('pointerup', onUp);
    runtime.current = { stage, orbit, gizmo, bounds, editor };
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!loaded) return;
      const p = current.current;
      const width = canvas.current!.clientWidth,
        height = canvas.current!.clientHeight;
      if (!width || !height) return;
      if (
        stage.renderer.domElement.width !== Math.floor(width * stage.renderer.getPixelRatio()) ||
        stage.renderer.domElement.height !== Math.floor(height * stage.renderer.getPixelRatio())
      )
        stage.resize(width, height);
      editor.aspect = width / height;
      editor.updateProjectionMatrix();
      orbit.enabled = p.mode === 'stage' && !gizmo.dragging;
      orbit.update();
      if (!gizmo.dragging) stage.update(p.shot, p.time);
      const selected = p.selection ? stage.objects.get(p.selection) : null;
      if (
        selected &&
        p.mode === 'stage' &&
        !p.project.entities.find((e) => e.id === p.selection)?.locked
      ) {
        if (gizmo.object !== selected) gizmo.attach(selected);
        gizmo.setMode(p.tool);
        gizmo.setTranslationSnap(p.snap || null);
      } else gizmo.detach();
      bounds.visible = !!selected && p.mode === 'stage';
      if (selected) bounds.setFromObject(selected);
      stage.render(p.mode === 'stage' ? editor : stage.camera);
    };
    tick();
    (stage as Stage & { setLoaded: (b: boolean) => void }).setLoaded = (b) => (loaded = b);
    return () => {
      cancelAnimationFrame(frame);
      canvas.current?.removeEventListener('pointerdown', onDown);
      canvas.current?.removeEventListener('pointerup', onUp);
      gizmo.dispose();
      orbit.dispose();
      bounds.geometry.dispose();
      (bounds.material as THREE.Material).dispose();
      stage.dispose();
      runtime.current = null;
    };
  }, []);
  useEffect(() => {
    const r = runtime.current;
    if (!r) return;
    let active = true;
    const project = props.project;
    setLoading(true);
    setError('');
    r.gizmo.detach();
    r.bounds.visible = false;
    const stage = r.stage as Stage & { setLoaded: (b: boolean) => void };
    stage.setLoaded(false);
    stage
      .load(project)
      .then(() => {
        if (!active || current.current.project.revision !== project.revision) return;
        const images: Record<string, string> = {};
        const pixelRatio = stage.renderer.getPixelRatio();
        const helper = r.gizmo.getHelper();
        const helperVisible = helper.visible;
        try {
          helper.visible = false;
          r.bounds.visible = false;
          stage.renderer.setPixelRatio(1);
          const [w, h] = project.aspect.split(':').map(Number);
          stage.resize(160, Math.round((160 * h) / w));
          for (const shot of project.shots.slice(0, 12)) {
            stage.update(shot, 0);
            stage.render(stage.camera);
            images[shot.id] = stage.renderer.domElement.toDataURL('image/jpeg', 0.78);
          }
        } finally {
          stage.renderer.setPixelRatio(pixelRatio);
          helper.visible = helperVisible;
          if (canvas.current)
            stage.resize(
              Math.max(1, canvas.current.clientWidth),
              Math.max(1, canvas.current.clientHeight),
            );
        }
        if (active && current.current.project.revision === project.revision) {
          current.current.onThumbnails?.(images, project.revision);
          stage.setLoaded(true);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(t('片场加载失败：') + e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [props.project]);
  const [rw, rh] = props.project.aspect.split(':').map(Number);
  const ratio = rw / rh;
  const width = Math.max(1, Math.min(size.width - 40, (size.height - 68) * ratio));
  return (
    <div ref={container} className={'viewport mode-' + props.mode}>
      <div
        className="canvas-wrap"
        style={
          props.mode === 'camera'
            ? { width, height: width / ratio, maxHeight: 'none', aspectRatio: String(ratio) }
            : undefined
        }
      >
        <canvas ref={canvas} aria-label={t('三维片场')} />
        <div className="frame-corners" />
      </div>
      <div className="viewport-label">
        <span className="live-dot" />
        {props.mode === 'stage' ? t('自由布置') : t('摄影机')}
        <span>{props.shot.name}</span>
      </div>
      <div className="viewport-meta">
        {props.project.aspect} <span>·</span> {props.project.fps} FPS <span>·</span>{' '}
        {props.mode === 'stage' ? t('拖动旋转 · 滚轮缩放') : `${props.shot.camera.fov}° FOV`}
      </div>
      {props.mode === 'stage' && (
        <button
          className="capture-view"
          onClick={() => {
            const r = runtime.current;
            if (r) props.onCapture(r.editor.position.toArray(), r.orbit.target.toArray());
          }}
        >
          {t('将此视角设为镜头起点 ↗')}
        </button>
      )}
      {loading && <div className="canvas-message">{t('正在布置片场…')}</div>}
      {error && <div className="canvas-message error">{localizeError(error)}</div>}
    </div>
  );
}
