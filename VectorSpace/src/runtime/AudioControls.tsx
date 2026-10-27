/**
 * @file        AudioControls.tsx
 * @brief       Visitor's mute button and volume slider for the simulation.
 *
 * @responsibility
 * Controlled view over the visitor's master volume and mute; RuntimeView owns
 * the state and passes it to the Viewport. Does not touch the AudioSystem.
 */
interface AudioControlsProps {
  volume: number
  muted: boolean
  onVolumeChange: (volume: number) => void
  onMutedChange: (muted: boolean) => void
}

export default function AudioControls({ volume, muted, onVolumeChange, onMutedChange }: AudioControlsProps) {
  // A muted visitor who drags the slider wants sound back; leaving it muted would look like a broken slider.
  const changeVolume = (next: number) => {
    onVolumeChange(next)
    if (muted && next > 0) onMutedChange(false)
  }
  const silent = muted || volume === 0
  return (
    <div className="runtime-audio" role="group" aria-label="Sound">
      <button
        type="button"
        className="runtime-audio-mute"
        aria-pressed={silent}
        aria-label={silent ? 'Unmute sound' : 'Mute sound'}
        title={silent ? 'Unmute (M)' : 'Mute (M)'}
        onClick={() => onMutedChange(!muted)}
      >
        {silent ? 'Sound off' : 'Sound on'}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={muted ? 0 : volume}
        aria-label="Volume"
        onChange={(event) => changeVolume(Number(event.target.value))}
      />
    </div>
  )
}
