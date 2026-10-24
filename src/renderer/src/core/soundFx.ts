import { playSound, type SoundEvent } from './sounds'
import { useAppStore } from '../store/app'

/**
 * Play a UI sound with the theme and volume from the settings.
 * Never throws and stays silent when sounds are switched off.
 */
export function sfx(event: SoundEvent): void {
  try {
    const settings = useAppStore.getState().settings
    if (!settings.soundsEnabled) return
    playSound(event, settings.soundTheme, settings.soundVolume)
  } catch {
    /* audio is a nicety, never a problem */
  }
}
