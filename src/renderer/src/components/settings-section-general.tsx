import { useState, type ReactElement } from 'react'
import { FeedbackForm } from './FeedbackForm'
import { UsageStatsView } from './UsageStatsView'
import {
  getPrivacySettings,
  savePrivacySettings,
  clearSensitiveData,
  type PrivacyLevel
} from '../lib/privacy-manager'
import type { ApprovalPolicy, AppSettingsV1, SandboxMode } from '@shared/app-settings'
import {
  DEFAULT_WRITE_INLINE_COMPLETION_BASE_URL,
  DEFAULT_WRITE_INLINE_COMPLETION_MAX_TOKENS,
  DEFAULT_WRITE_INLINE_COMPLETION_MODEL,
  DEFAULT_WRITE_INLINE_LONG_COMPLETION_MAX_TOKENS,
  DEFAULT_KUN_DATA_DIR,
  WRITE_INLINE_COMPLETION_MODEL_IDS,
  isKunRuntimeInsecure,
  PRESET_PROVIDERS
} from '@shared/app-settings'
import type { GuiUpdateChannel } from '@shared/gui-update'
import type { SkillRootId } from '../lib/skill-root-preference'
import { CheckCircle, FolderOpen, Loader2, PencilLine, RefreshCw, Settings, XCircle } from 'lucide-react'
import { GuiUpdateControl } from './settings-gui-update'
import {
  InlineNoticeView,
  SecretInput,
  SectionJumpButton,
  SettingsCard,
  SettingRow,
  Toggle
} from './settings-controls'

export function GeneralSettingsSection({ ctx }: { ctx: Record<string, any> }): ReactElement {
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [connectionMessage, setConnectionMessage] = useState('')
  const [privacySettings, setPrivacySettings] = useState(getPrivacySettings)
  const [privacySuccess, setPrivacySuccess] = useState(false)
  const [showAgnesApiKey, setShowAgnesApiKey] = useState(false)
  
  const {
    t,
    tCommon,
    form,
    kun,
    activeApiKey,
    update,
    updateKun,
    updateSharedCredential,
    sharedApiKey,
    sharedBaseUrl,
    showApiKey,
    setShowApiKey,
    showRuntimeToken,
    setShowRuntimeToken,
    portError,
    selectControlClass,
    openOnboardingPreview,
    pickWorkspace,
    resetWorkspaceToDefault,
    workspacePickerError,
    guiUpdateInfo,
    checkingGuiUpdate,
    downloadingGuiUpdate,
    installingGuiUpdate,
    guiUpdateDownloaded,
    guiUpdateProgress,
    guiUpdateError,
    checkGuiUpdate,
    downloadGuiUpdate,
    installGuiUpdate,
    logPath,
    logDirOpenError,
    setLogDirOpenError,
    pickWriteWorkspace,
    resetWriteWorkspaceToDefault,
    writeWorkspacePickerError,
    writeInlineBaseUrlInherited,
    effectiveWriteInlineBaseUrl,
    writeInlineModelInherited,
    effectiveWriteInlineModel,
    setWriteDebugModalOpen,
    loadWriteDebugEntries,
    scrollToAgentSection,
    agentsSectionRef,
    skillSectionRef,
    mcpSectionRef,
    permissionsSectionRef,
    selectedSkillRoot,
    skillRootOptions,
    skillRootId,
    setSkillRootId,
    skillNotice,
    openSkillRoot,
    openPlugins,
    mcpConfigPath,
    mcpConfigExists,
    mcpConfigText,
    setMcpConfigText,
    mcpLoading,
    mcpBusy,
    mcpNotice,
    saveMcpConfig,
    loadMcpConfig,
    openMcpConfigDir,
    pickClawWorkspace,
    resetClawWorkspaceToDefault,
    clawWorkspacePickerError,
    splitSettingsList,
    listSettingsText
  } = ctx
  
  const handleTestConnection = async () => {
    if (!sharedApiKey.trim()) {
      setConnectionStatus('error')
      setConnectionMessage(t('connectionFailed').replace('{{error}}', 'API Key cannot be empty'))
      return
    }
    
    setTestingConnection(true)
    setConnectionStatus('idle')
    setConnectionMessage('')
    
    try {
      const response = await window.dsGui.fetchUpstreamModels()
      
      if (response.ok) {
        setConnectionStatus('success')
        const modelCount = response.modelIds?.length || 0
        setConnectionMessage(t('connectionSuccess').replace('{{count}}', String(modelCount)))
      } else {
        setConnectionStatus('error')
        setConnectionMessage(t('connectionFailed').replace('{{error}}', response.message || 'Unknown error'))
      }
    } catch (error) {
      setConnectionStatus('error')
      setConnectionMessage(t('connectionFailed').replace('{{error}}', error instanceof Error ? error.message : String(error)))
    } finally {
      setTestingConnection(false)
    }
  }
  const platform = typeof window !== 'undefined' ? window.dsGui?.platform ?? '' : ''
  const openAtLoginSupported = platform === 'win32' || platform === 'darwin'
  const startMinimizedSupported = platform === 'win32'
  const desktopBehavior = form.appBehavior

  return (
            <>
              <SettingsCard title={t('sectionGeneral')}>
                <SettingRow
                  title={t('apiKey')}
                  description={t('apiKeySharedDesc')}
                  control={
                    <div className="flex flex-col gap-2 md:max-w-md">
                      <SecretInput
                        value={sharedApiKey}
                        onChange={(value) => updateSharedCredential({ apiKey: value })}
                        visible={showApiKey}
                        onToggleVisibility={() => setShowApiKey((value: boolean) => !value)}
                        placeholder="sk-..."
                        autoComplete="off"
                        invalid={!activeApiKey.trim()}
                        showLabel={t('showSecret')}
                        hideLabel={t('hideSecret')}
                        className="w-full"
                      />
                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testingConnection || !sharedApiKey.trim()}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-ds-border bg-ds-card px-4 py-2 text-[14px] font-medium text-ds-ink shadow-sm transition hover:bg-ds-hover disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {testingConnection ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t('testingConnection')}
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4" />
                            {t('testConnection')}
                          </>
                        )}
                      </button>
                      {connectionStatus !== 'idle' && connectionMessage && (
                        <div className={`flex items-center gap-2 text-[13px] ${connectionStatus === 'success' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                          {connectionStatus === 'success' ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          {connectionMessage}
                        </div>
                      )}
                    </div>
                  }
                />
                <SettingRow
                  title={t('modelProvider')}
                  description={t('modelProviderDesc')}
                  control={
                    <select
                      className={selectControlClass}
                      value={form.modelProvider?.id || 'deepseek'}
                      onChange={(e) => {
                        const providerId = e.target.value
                        const provider = PRESET_PROVIDERS[providerId]
                        if (provider) {
                          updateSharedCredential({
                            baseUrl: provider.baseUrl,
                            endpointFormat: provider.endpointFormat
                          })
                          update({ modelProvider: { id: providerId, name: provider.name } })
                        }
                      }}
                    >
                      <option value="deepseek">{PRESET_PROVIDERS.deepseek.name}</option>
                      <option value="openai">{PRESET_PROVIDERS.openai.name}</option>
                      <option value="anthropic">{PRESET_PROVIDERS.anthropic.name}</option>
                      <option value="gemini">{PRESET_PROVIDERS.gemini.name}</option>
                      <option value="sapiens">{PRESET_PROVIDERS.sapiens.name}</option>
                      <option value="custom">{t('customProvider')}</option>
                    </select>
                  }
                />
                <SettingRow
                  title={t('baseUrl')}
                  description={t('baseUrlSharedDesc')}
                  control={
                    <input
                      className="w-full min-w-0 rounded-xl border border-ds-border bg-ds-card px-3 py-2 text-[14px] text-ds-ink shadow-sm focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/30 md:max-w-md"
                      placeholder={t('baseUrlPlaceholder')}
                      value={sharedBaseUrl}
                      onChange={(e) => updateSharedCredential({ baseUrl: e.target.value })}
                    />
                  }
                />
                <SettingRow
                  title={t('language')}
                  description={t('languageDesc')}
                  control={
                    <select
                      className={selectControlClass}
                      value={form.locale}
                      onChange={(e) => update({ locale: e.target.value as 'en' | 'zh' })}
                    >
                      <option value="en">English</option>
                      <option value="zh">简体中文</option>
                    </select>
                  }
                />
                <SettingRow
                  title={t('theme')}
                  description={t('themeDesc')}
                  control={
                    <select
                      className={selectControlClass}
                      value={form.theme}
                      onChange={(e) => update({ theme: e.target.value as AppSettingsV1['theme'] })}
                    >
                      <option value="system">{t('themeSystem')}</option>
                      <option value="light">{t('themeLight')}</option>
                      <option value="dark">{t('themeDark')}</option>
                    </select>
                  }
                />
                <SettingRow
                  title={t('onboardingPreview')}
                  description={t('onboardingPreviewDesc')}
                  control={
                    <button
                      type="button"
                      onClick={openOnboardingPreview}
                      className="w-full rounded-xl border border-ds-border bg-ds-card px-3 py-2 text-[14px] font-medium text-ds-ink shadow-sm transition hover:bg-ds-hover"
                    >
                      {t('onboardingPreviewOpen')}
                    </button>
                  }
                />
                <SettingRow
                  title={t('fontScale')}
                  description={t('fontScaleDesc')}
                  control={
                    <select
                      className={selectControlClass}
                      value={form.uiFontScale}
                      onChange={(e) =>
                        update({
                          uiFontScale: e.target.value as AppSettingsV1['uiFontScale']
                        })
                      }
                    >
                      <option value="extraSmall">{t('fontScaleExtraSmall')}</option>
                      <option value="small">{t('fontScaleSmall')}</option>
                      <option value="medium">{t('fontScaleMedium')}</option>
                      <option value="large">{t('fontScaleLarge')}</option>
                      <option value="extraLarge">{t('fontScaleExtraLarge')}</option>
                    </select>
                  }
                />
                <SettingRow
                  title={t('accentColor')}
                  description={t('accentColorDesc')}
                  control={
                    <div className="flex items-center gap-2">
                      {(['blue', 'purple', 'green', 'orange', 'pink', 'cyan'] as const).map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => update({ accentColor: color })}
                          className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                            form.accentColor === color ? 'ring-2 ring-offset-2 ring-ds-ink' : ''
                          }`}
                          style={{
                            backgroundColor: {
                              blue: '#3b82f6',
                              purple: '#8b5cf6',
                              green: '#22c55e',
                              orange: '#f97316',
                              pink: '#ec4899',
                              cyan: '#06b6d4'
                            }[color]
                          }}
                          title={t(`accentColor${color.charAt(0).toUpperCase() + color.slice(1)}`)}
                        />
                      ))}
                    </div>
                  }
                />
                <SettingRow
                  title={t('turnCompleteNotification')}
                  description={t('turnCompleteNotificationDesc')}
                  control={
                    <Toggle
                      checked={form.notifications.turnComplete}
                      onChange={(v) => update({ notifications: { turnComplete: v } })}
                    />
                  }
                />
                <SettingRow
                  title={t('workspaceRoot')}
                  description={t('workspaceRootDesc')}
                  control={
                    <div className="w-full min-w-[200px] md:max-w-xl">
                      <div className="flex items-center gap-2">
                        <input
                          className="w-full rounded-xl border border-ds-border bg-ds-card px-3 py-2 text-[14px] text-ds-ink shadow-sm focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/30"
                          value={form.workspaceRoot}
                          onChange={(e) => update({ workspaceRoot: e.target.value })}
                          placeholder={t('workspaceRootPlaceholder')}
                        />
                        <button
                          type="button"
                          onClick={resetWorkspaceToDefault}
                          className="shrink-0 rounded-xl border border-ds-border bg-ds-card px-3 py-2 text-[13px] font-medium text-ds-ink shadow-sm transition hover:bg-ds-hover"
                        >
                          {t('restoreWorkspaceDefault')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void pickWorkspace()}
                          className="shrink-0 rounded-xl border border-ds-border bg-ds-card px-3 py-2 text-[13px] font-medium text-ds-ink shadow-sm transition hover:bg-ds-hover"
                        >
                          {t('browse')}
                        </button>
                      </div>
                      {workspacePickerError ? (
                        <p className="mt-2 text-[13px] leading-5 text-amber-700 dark:text-amber-300">
                          {workspacePickerError}
                        </p>
                      ) : null}
                    </div>
                  }
                />
              </SettingsCard>

              <SettingsCard title={t('userPreferences')} className="mt-6">
                <SettingRow
                  title={t('autoSaveHistory')}
                  description={t('autoSaveHistoryDesc')}
                  control={
                    <Toggle
                      checked={form.preferences?.autoSaveHistory ?? true}
                      onChange={(v) => update({ preferences: { autoSaveHistory: v } })}
                    />
                  }
                />
                <SettingRow
                  title={t('rememberLastWorkspace')}
                  description={t('rememberLastWorkspaceDesc')}
                  control={
                    <Toggle
                      checked={form.preferences?.rememberLastWorkspace ?? true}
                      onChange={(v) => update({ preferences: { rememberLastWorkspace: v } })}
                    />
                  }
                />
                <SettingRow
                  title={t('autoFocusInput')}
                  description={t('autoFocusInputDesc')}
                  control={
                    <Toggle
                      checked={form.preferences?.autoFocusInput ?? true}
                      onChange={(v) => update({ preferences: { autoFocusInput: v } })}
                    />
                  }
                />
                <SettingRow
                  title={t('showWelcomeTips')}
                  description={t('showWelcomeTipsDesc')}
                  control={
                    <Toggle
                      checked={form.preferences?.showWelcomeTips ?? true}
                      onChange={(v) => update({ preferences: { showWelcomeTips: v } })}
                    />
                  }
                />
                <SettingRow
                  title={t('compactMode')}
                  description={t('compactModeDesc')}
                  control={
                    <Toggle
                      checked={form.preferences?.compactMode ?? false}
                      onChange={(v) => update({ preferences: { compactMode: v } })}
                    />
                  }
                />
                <SettingRow
                  title={t('conversationSortOrder')}
                  description={t('conversationSortOrderDesc')}
                  control={
                    <select
                      className={selectControlClass}
                      value={form.preferences?.conversationSortOrder ?? 'latest'}
                      onChange={(e) =>
                        update({
                          preferences: { conversationSortOrder: e.target.value as AppSettingsV1['preferences']['conversationSortOrder'] }
                        })
                      }
                    >
                      <option value="latest">{t('conversationSortLatest')}</option>
                      <option value="oldest">{t('conversationSortOldest')}</option>
                      <option value="alphabetical">{t('conversationSortAlphabetical')}</option>
                    </select>
                  }
                />
                <SettingRow
                  title={t('defaultCompletionMode')}
                  description={t('defaultCompletionModeDesc')}
                  control={
                    <select
                      className={selectControlClass}
                      value={form.preferences?.defaultCompletionMode ?? 'agent'}
                      onChange={(e) =>
                        update({
                          preferences: { defaultCompletionMode: e.target.value as AppSettingsV1['preferences']['defaultCompletionMode'] }
                        })
                      }
                    >
                      <option value="agent">{t('completionModeAgent')}</option>
                      <option value="plan">{t('completionModePlan')}</option>
                    </select>
                  }
                />
              </SettingsCard>

              <SettingsCard title={t('desktopBehavior')} className="mt-6">
                <SettingRow
                  title={t('desktopOpenAtLogin')}
                  description={
                    openAtLoginSupported
                      ? t('desktopOpenAtLoginDesc')
                      : t('desktopOpenAtLoginUnsupportedDesc')
                  }
                  control={
                    <Toggle
                      checked={desktopBehavior.openAtLogin}
                      disabled={!openAtLoginSupported}
                      onChange={(v) =>
                        update({
                          appBehavior: {
                            openAtLogin: v,
                            startMinimized: v ? desktopBehavior.startMinimized : false
                          }
                        })
                      }
                    />
                  }
                />
                <SettingRow
                  title={t('desktopStartMinimized')}
                  description={
                    desktopBehavior.openAtLogin && startMinimizedSupported
                      ? t('desktopStartMinimizedDesc')
                      : t('desktopStartMinimizedDisabledDesc')
                  }
                  control={
                    <Toggle
                      checked={desktopBehavior.startMinimized}
                      disabled={!desktopBehavior.openAtLogin || !startMinimizedSupported}
                      onChange={(v) => update({ appBehavior: { startMinimized: v } })}
                    />
                  }
                />
                <SettingRow
                  title={t('desktopCloseToTray')}
                  description={t('desktopCloseToTrayDesc')}
                  control={
                    <Toggle
                      checked={desktopBehavior.closeToTray}
                      onChange={(v) => update({ appBehavior: { closeToTray: v } })}
                    />
                  }
                />
              </SettingsCard>

              <SettingsCard title={t('guiUpdate')} className="mt-6">
                <SettingRow
                  title={t('guiUpdateChannel')}
                  description={t('guiUpdateChannelDesc')}
                  control={
                    <select
                      className={selectControlClass}
                      value={form.guiUpdate.channel}
                      onChange={(e) =>
                        update({
                          guiUpdate: { channel: e.target.value as GuiUpdateChannel }
                        })
                      }
                    >
                      <option value="frontier">{t('guiUpdateChannelFrontier')}</option>
                      <option value="stable">{t('guiUpdateChannelStable')}</option>
                    </select>
                  }
                />
                <SettingRow
                  title={t('guiUpdate')}
                  description={t('guiUpdateDesc')}
                  control={
                    <GuiUpdateControl
                      info={guiUpdateInfo}
                      checking={checkingGuiUpdate}
                      downloading={downloadingGuiUpdate}
                      installing={installingGuiUpdate}
                      downloaded={guiUpdateDownloaded}
                      progress={guiUpdateProgress}
                      error={guiUpdateError}
                      onCheck={checkGuiUpdate}
                      onDownload={downloadGuiUpdate}
                      onInstall={installGuiUpdate}
                      t={t}
                    />
                  }
                />
              </SettingsCard>

              <SettingsCard title={t('agnesGenerationTitle')} className="mt-6">
                <p className="text-sm text-ds-muted mb-4">{t('agnesGenerationDesc')}</p>
                <SettingRow
                  title={t('agnesGenerationEnabled')}
                  description={t('agnesGenerationEnabledDesc')}
                  control={
                    <Toggle
                      checked={form.agnesGeneration?.enabled ?? false}
                      onChange={(v) => update({ agnesGeneration: { enabled: v } })}
                    />
                  }
                />
                {(form.agnesGeneration?.enabled) && (
                  <>
                    <SettingRow
                      title={t('agnesGenerationBaseUrl')}
                      description={t('agnesGenerationBaseUrlDesc')}
                      control={
                        <input
                          type="text"
                          className="w-full rounded-lg border border-ds-border bg-ds-card px-3 py-1.5 text-sm text-ds-ink outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                          value={form.agnesGeneration?.baseUrl ?? ''}
                          onChange={(e) => update({ agnesGeneration: { baseUrl: e.target.value } })}
                          placeholder="https://api.siliconflow.cn/v1"
                        />
                      }
                    />
                    <SettingRow
                      title={t('agnesGenerationApiKey')}
                      description={t('agnesGenerationApiKeyDesc')}
                      control={
                        <SecretInput
                          value={form.agnesGeneration?.apiKey ?? ''}
                          onChange={(v) => update({ agnesGeneration: { apiKey: v } })}
                          visible={showAgnesApiKey}
                          onToggleVisibility={() => setShowAgnesApiKey((v) => !v)}
                          placeholder="sk-..."
                          autoComplete="off"
                          showLabel={t('showSecret')}
                          hideLabel={t('hideSecret')}
                        />
                      }
                    />
                    <SettingRow
                      title={t('agnesGenerationImageModel')}
                      description={t('agnesGenerationImageModelDesc')}
                      control={
                        <input
                          type="text"
                          className="w-full rounded-lg border border-ds-border bg-ds-card px-3 py-1.5 text-sm text-ds-ink outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                          value={form.agnesGeneration?.imageModel ?? ''}
                          onChange={(e) => update({ agnesGeneration: { imageModel: e.target.value } })}
                          placeholder="stabilityai/stable-diffusion-3-5-large"
                        />
                      }
                    />
                    <SettingRow
                      title={t('agnesGenerationVideoModel')}
                      description={t('agnesGenerationVideoModelDesc')}
                      control={
                        <input
                          type="text"
                          className="w-full rounded-lg border border-ds-border bg-ds-card px-3 py-1.5 text-sm text-ds-ink outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                          value={form.agnesGeneration?.videoModel ?? ''}
                          onChange={(e) => update({ agnesGeneration: { videoModel: e.target.value } })}
                          placeholder="tencent/HunyuanVideo"
                        />
                      }
                    />
                  </>
                )}
              </SettingsCard>

              <SettingsCard title={t('logTitle')} className="mt-6">
                <SettingRow
                  title={t('logEnabled')}
                  description={t('logEnabledDesc')}
                  control={
                    <Toggle
                      checked={form.log.enabled}
                      onChange={(v) => update({ log: { enabled: v } })}
                    />
                  }
                />
                <SettingRow
                  title={t('logRetention')}
                  description={t('logRetentionDesc')}
                  control={
                    <select
                      className={selectControlClass}
                      value={form.log.retentionDays}
                      onChange={(e) =>
                        update({ log: { retentionDays: Number(e.target.value) } })
                      }
                    >
                      <option value={1}>{t('logRetentionOne')}</option>
                      <option value={2}>{t('logRetentionTwo')}</option>
                      <option value={3}>{t('logRetentionThree')}</option>
                      <option value={5}>{t('logRetentionFive')}</option>
                      <option value={7}>{t('logRetentionSeven')}</option>
                    </select>
                  }
                />
                <SettingRow
                  title={t('logDir')}
                  description={t('logDirDesc')}
                  wideControl
                  control={
                    <div className="flex w-full min-w-0 flex-col items-start gap-2">
                      {logPath ? (
                        <code className="block w-full max-w-full break-all rounded-xl bg-ds-main/70 px-3 py-2 font-mono text-[12px] text-ds-muted shadow-sm">
                          {logPath}
                        </code>
                      ) : (
                        <span className="text-[13px] text-ds-faint">…</span>
                      )}
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-ds-border bg-ds-card px-3 py-1.5 text-[13px] font-medium text-ds-ink shadow-sm transition hover:bg-ds-hover disabled:opacity-50"
                        disabled={typeof window.dsGui?.openLogDir !== 'function'}
                        onClick={async () => {
                          if (typeof window.dsGui?.openLogDir !== 'function') return
                          setLogDirOpenError(null)
                          try {
                            const result = await window.dsGui.openLogDir()
                            if (!result.ok) setLogDirOpenError(result.message ?? 'Unknown error')
                          } catch (e) {
                            setLogDirOpenError(e instanceof Error ? e.message : String(e))
                          }
                        }}
                      >
                        <FolderOpen className="h-4 w-4" />
                        {t('logDirOpen')}
                      </button>
                      {logDirOpenError ? (
                        <p className="text-[12px] text-red-700 dark:text-red-300">
                          {logDirOpenError}
                        </p>
                      ) : null}
                    </div>
                  }
                />
              </SettingsCard>

              <SettingsCard title={t('feedback')} className="mt-6">
                <p className="text-sm text-ds-muted mb-4">{t('feedbackDesc')}</p>
                <FeedbackForm />
              </SettingsCard>

              <SettingsCard title={t('privacy')} className="mt-6">
                <p className="text-sm text-ds-muted mb-4">{t('privacyDesc')}</p>
                <SettingRow
                  title={t('privacyLevel')}
                  description={
                    privacySettings.level === 'standard' ? t('privacyLevelStandardDesc') :
                    privacySettings.level === 'enhanced' ? t('privacyLevelEnhancedDesc') :
                    t('privacyLevelMaximumDesc')
                  }
                  control={
                    <select
                      className={selectControlClass}
                      value={privacySettings.level}
                      onChange={(e) => {
                        const newSettings = savePrivacySettings({ level: e.target.value as PrivacyLevel })
                        setPrivacySettings(newSettings)
                      }}
                    >
                      <option value="standard">{t('privacyLevelStandard')}</option>
                      <option value="enhanced">{t('privacyLevelEnhanced')}</option>
                      <option value="maximum">{t('privacyLevelMaximum')}</option>
                    </select>
                  }
                />
                <SettingRow
                  title={t('autoLock')}
                  description={t('autoLockDesc')}
                  control={
                    <Toggle
                      checked={privacySettings.autoLock}
                      onChange={(v) => {
                        const newSettings = savePrivacySettings({ autoLock: v })
                        setPrivacySettings(newSettings)
                      }}
                    />
                  }
                />
                <SettingRow
                  title={t('clearClipboard')}
                  description={t('clearClipboardDesc')}
                  control={
                    <Toggle
                      checked={privacySettings.clearClipboard}
                      onChange={(v) => {
                        const newSettings = savePrivacySettings({ clearClipboard: v })
                        setPrivacySettings(newSettings)
                      }}
                    />
                  }
                />
                <SettingRow
                  title={t('hideSensitiveData')}
                  description={t('hideSensitiveDataDesc')}
                  control={
                    <Toggle
                      checked={privacySettings.hideSensitiveData}
                      onChange={(v) => {
                        const newSettings = savePrivacySettings({ hideSensitiveData: v })
                        setPrivacySettings(newSettings)
                      }}
                    />
                  }
                />
                <SettingRow
                  title={t('anonymousAnalytics')}
                  description={t('anonymousAnalyticsDesc')}
                  control={
                    <Toggle
                      checked={privacySettings.anonymousAnalytics}
                      onChange={(v) => {
                        const newSettings = savePrivacySettings({ anonymousAnalytics: v })
                        setPrivacySettings(newSettings)
                      }}
                    />
                  }
                />
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(t('clearSensitiveDataConfirm'))) {
                      clearSensitiveData()
                      setPrivacySuccess(true)
                      setTimeout(() => setPrivacySuccess(false), 3000)
                    }
                  }}
                  className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-700 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
                >
                  {t('clearSensitiveData')}
                </button>
                {privacySuccess && (
                  <p className="mt-2 text-sm text-emerald-600">{t('clearSensitiveDataSuccess')}</p>
                )}
              </SettingsCard>

              <SettingsCard title={t('usageStats')} className="mt-6">
                <p className="text-sm text-ds-muted mb-4">{t('usageStatsDesc')}</p>
                <UsageStatsView />
              </SettingsCard>
            </>
  )
}
