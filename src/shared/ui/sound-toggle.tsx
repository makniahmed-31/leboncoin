import { SoundOffIcon, SoundOnIcon } from '@/shared/ui/icons'

/**
 * Turns the notification sound on and off.
 *
 * Presentational and prop-driven, with the preference owned by whoever renders it. That split is
 * the layering rule rather than a preference: `shared/` may not reach into `stores/`, so a version
 * of this that read the store itself would belong to a feature — and a feature's components are
 * not importable by the other features that need this in their header.
 *
 * A button rather than a switch. The state is carried by the icon and the accessible name, and a
 * switch would add a role whose "on" and "off" say less here than the verbs do.
 */
export function SoundToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  const label = enabled ? 'Couper le son des notifications' : 'Activer le son des notifications'

  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      aria-pressed={enabled}
      className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors"
    >
      {enabled ? (
        <SoundOnIcon className="h-[18px] w-[18px]" />
      ) : (
        <SoundOffIcon className="h-[18px] w-[18px]" />
      )}
    </button>
  )
}
