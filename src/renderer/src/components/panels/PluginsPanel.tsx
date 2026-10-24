import type { JSX } from 'react'
import { useEffect, useState } from 'react'
import { useAppStore } from '../../store/app'
import {
  activatePlugin,
  deactivatePlugin,
  getLoadedPlugins,
  loadAllPlugins,
  type LoadedPlugin,
} from '../../core/plugins'
import { useT } from '../../core/i18n'

export function PluginsPanel(): JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const saveSettings = useAppStore((s) => s.saveSettings)
  const toast = useAppStore((s) => s.toast)
  const [plugins, setPlugins] = useState<LoadedPlugin[]>([])
  const [loading, setLoading] = useState(true)
  const t = useT()

  useEffect(() => {
    void loadAllPlugins().then((list) => {
      setPlugins(list)
      setLoading(false)
    })
  }, [])

  const enabled = new Set(settings.plugins)

  const toggle = (plugin: LoadedPlugin): void => {
    if (enabled.has(plugin.manifest.id)) {
      deactivatePlugin(plugin.manifest.id)
      const next = settings.plugins.filter((id) => id !== plugin.manifest.id)
      setSettings({ plugins: next })
      toast(t('panel.pluginDisabled', { name: plugin.manifest.name }))
    } else {
      const error = activatePlugin(plugin.manifest.id)
      if (error) {
        toast(t('panel.pluginFailed', { name: plugin.manifest.name, error }), 'error')
        return
      }
      setSettings({ plugins: [...settings.plugins, plugin.manifest.id] })
      toast(t('panel.pluginEnabled', { name: plugin.manifest.name }), 'success')
    }
    void saveSettings()
  }

  if (loading) return <div className="empty-state">{t('panel.pluginsLoading')}</div>

  if (plugins.length === 0) {
    return (
      <div className="empty-state">
        {t('panel.pluginsEmpty')}
        <br />
        <span style={{ fontSize: 11 }}>{t('panel.pluginsHint')}</span>
      </div>
    )
  }

  return (
    <div>
      <div className="panel-header">
        <span>{t('panel.plugins')}</span>
      </div>
      {plugins.map((plugin) => (
        <div className="plugin-card" key={plugin.manifest.id}>
          <div style={{ minWidth: 0 }}>
            <div>{plugin.manifest.name}</div>
            <div className="meta">
              v{plugin.manifest.version}
              {plugin.manifest.description ? ` — ${plugin.manifest.description}` : ''}
              {plugin.error ? ` — ${plugin.error}` : ''}
            </div>
          </div>
          <button
            className="icon-btn"
            onClick={() => toggle(plugin)}
            title={enabled.has(plugin.manifest.id) ? t('common.disable') : t('common.enable')}
          >
            {enabled.has(plugin.manifest.id) ? t('common.disable') : t('common.enable')}
          </button>
        </div>
      ))}
      <div className="hint">
        {t('panel.pluginsEnabledCount', {
          enabled: getLoadedPlugins().filter((p) => p.active).length,
          total: plugins.length,
        })}
      </div>
    </div>
  )
}
