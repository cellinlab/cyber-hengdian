import { useI18n } from '../i18n';
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
  const { t, catalogText } = useI18n();
  const total = project.shots.reduce((n, s) => n + s.duration, 0);
  return (
    <section className="timeline" aria-label={t('镜头时间轴')}>
      <div className="timeline-top">
        <div className="timeline-title">
          <Icon name="film" />
          <strong>{t('镜头序列')}</strong>
          <span>
            {t('{count} 镜头 · {duration} 秒', {
              count: project.shots.length,
              duration: total.toFixed(1),
            })}
          </span>
        </div>
        <div className="transport">
          <Button
            icon={playing ? 'pause' : 'play'}
            aria-label={playing ? t('暂停播放') : t('播放镜头')}
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
          {t('添加镜头')}
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
                  <img
                    src={thumbnails[s.id]}
                    alt={t('{p0} 起始帧', { p0: s.name })}
                    draggable={false}
                  />
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
                    ? t('跟随镜头')
                    : s.camera.from.every((v, j) => v === s.camera.to[j])
                      ? t('固定机位')
                      : t('运动镜头')}
                </span>
              </div>
            </button>
          ))}
          <button
            className="add-shot-card"
            aria-label={t('添加镜头配方')}
            onClick={() => setModal('recipes')}
          >
            <Icon name="plus" size={22} />
            <span>{t('下一个镜头')}</span>
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
                title={t('{p0} 秒关键帧', { p0: k.time.toFixed(2) })}
                aria-label={t('跳到 {p0} 秒关键帧', { p0: k.time })}
                onClick={() => {
                  setTime(k.time);
                  setPlaying(false);
                }}
              />
            ))}
            {(entity ? (shot.poseTracks?.[entity.id] ?? []) : []).map((key) => (
              <button
                className="key-marker pose-marker"
                key={'pose-' + key.time}
                style={{ left: `${(key.time / shot.duration) * 100}%` }}
                title={t('跳到 {time} 秒姿态关键帧', { time: key.time })}
                aria-label={t('跳到 {time} 秒姿态关键帧', { time: key.time })}
                onClick={() => {
                  setTime(key.time);
                  setPlaying(false);
                }}
              />
            ))}
            <input
              aria-label={t('镜头时间')}
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
            <span>
              {entity ? entity.name + t(' · 关键帧轨道') : t('选择一个对象，编排它的动作')}
            </span>
            <span>
              {project.fps} FPS · {project.aspect}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
