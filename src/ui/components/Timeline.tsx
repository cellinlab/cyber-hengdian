import type { Project, Entity, Shot, Key } from '../../core/schema';
import type { Set, Modal } from '../types';
import { Icon } from '../Icons';
import { Button } from './Controls';
import { pad, clock } from '../format';

type TimelineProps = {
  project: Project;
  shot: Shot;
  entity: Entity | undefined;
  time: number;
  playing: boolean;
  setPlaying: Set<boolean>;
  setTime: Set<number>;
  setModal: Set<Modal>;
  selectShot: (id: string) => void;
  setSelection: Set<string | null>;
  selectedKeys: Key[];
  thumbnails: Record<string, string>;
};
export function Timeline({
  project,
  shot,
  entity,
  time,
  playing,
  setPlaying,
  setTime,
  setModal,
  selectShot,
  setSelection,
  selectedKeys,
  thumbnails,
}: TimelineProps) {
  const total = project.shots.reduce((n, s) => n + s.duration, 0);
  return (
    <section className="timeline" aria-label="镜头时间轴">
      <div className="timeline-top">
        <div className="timeline-title">
          <Icon name="film" />
          <strong>镜头序列</strong>
          <span>
            {project.shots.length} 镜头 · {total.toFixed(1)} 秒
          </span>
        </div>
        <div className="transport">
          <Button
            icon={playing ? 'pause' : 'play'}
            aria-label={playing ? '暂停播放' : '播放镜头'}
            className="play-button"
            onClick={() => {
              if (time >= shot.duration) setTime(0);
              setPlaying(!playing);
            }}
          />
          <code>{clock(time, project.fps)}</code>
          <span>/ {clock(shot.duration, project.fps)}</span>
        </div>
        <Button icon="plus" onClick={() => setModal('recipes')}>
          添加镜头
        </Button>
      </div>
      <div className="timeline-content">
        <div className="shot-strip">
          {project.shots.map((s, i) => (
            <button
              key={s.id}
              className={'shot-card ' + (s.id === shot.id ? 'selected' : '')}
              onClick={() => {
                selectShot(s.id);
                setSelection(null);
              }}
            >
              <div
                className={
                  'shot-art art-' + project.environment + (thumbnails[s.id] ? ' has-thumbnail' : '')
                }
              >
                {thumbnails[s.id] ? (
                  <img src={thumbnails[s.id]} alt={`${s.name} 起始帧`} draggable={false} />
                ) : (
                  <Icon name="camera" size={25} />
                )}
                <span>{pad(i + 1)}</span>
                <small>{s.duration.toFixed(1)}s</small>
              </div>
              <div>
                <strong>{s.name}</strong>
                <span>
                  {s.camera.follow
                    ? '跟随镜头'
                    : s.camera.from.every((v, j) => v === s.camera.to[j])
                      ? '固定机位'
                      : '运动镜头'}
                </span>
              </div>
            </button>
          ))}
          <button
            className="add-shot-card"
            aria-label="添加镜头配方"
            onClick={() => setModal('recipes')}
          >
            <Icon name="plus" size={22} />
            <span>下一个镜头</span>
          </button>
        </div>
        <div className="scrubber">
          <div className="ruler">
            <span>00:00</span>
            <span>{(shot.duration / 4).toFixed(1)}s</span>
            <span>{(shot.duration / 2).toFixed(1)}s</span>
            <span>{((shot.duration * 3) / 4).toFixed(1)}s</span>
            <span>{shot.duration.toFixed(1)}s</span>
          </div>
          <div className="seek-track">
            <div className="seek-progress" style={{ width: `${(time / shot.duration) * 100}%` }} />
            {selectedKeys.map((k) => (
              <button
                className="key-marker"
                key={k.time}
                style={{ left: `${(k.time / shot.duration) * 100}%` }}
                title={`${k.time.toFixed(2)} 秒关键帧`}
                aria-label={`跳到 ${k.time} 秒关键帧`}
                onClick={() => {
                  setTime(k.time);
                  setPlaying(false);
                }}
              />
            ))}
            <input
              aria-label="镜头时间"
              type="range"
              min={0}
              max={shot.duration}
              step={1 / Number(project.fps)}
              value={time}
              onChange={(e) => {
                setTime(Number(e.target.value));
                setPlaying(false);
              }}
            />
          </div>
          <div className="timeline-hint">
            <span>{entity ? entity.name + ' · 关键帧轨道' : '选择一个对象，编排它的动作'}</span>
            <span>
              {project.fps} FPS · {project.aspect}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
