import React, { useEffect, useEffectEvent, useRef } from 'react';
import type { ReactElement } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { Route, Routes, useHref, useLocation } from 'react-router';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as undo from '@actual-app/core/platform/client/undo';

import { sync } from '#app/appSlice';
import { useAutomaticBankSync } from '#hooks/useAutomaticBankSync';
import { useMetaThemeColor } from '#hooks/useMetaThemeColor';
import { useNavigate } from '#hooks/useNavigate';
import { ScrollProvider } from '#hooks/useScrollListener';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';

import { BankSyncStatus } from './BankSyncStatus';
import { CommandBar } from './CommandBar';
import { ContextMenu } from './ContextMenu';
import { EnableBankingCallback } from './EnableBankingCallback';
import { FeatureErrorFallback } from './FeatureErrorFallback';
import { MobileBankSyncAccountEditPage } from './mobile/banksync/MobileBankSyncAccountEditPage';
import { MobileNavTabs } from './mobile/MobileNavTabs';
import { TransactionEdit } from './mobile/transactions/TransactionEdit';
import { Notifications } from './Notifications';
import { MobilePageHeaderProvider, MobilePageHeaderSlot } from './Page';
import { PortfolioPage } from './portfolio/PortfolioPage';
import { Reports } from './reports';
import { NarrowAlternate, WideComponent } from './responsive';
import {
  AdvancedSettings,
  ExperimentalSettings,
  GeneralSettings,
  Settings,
  SettingsIndex,
} from './settings';
import { FloatableSidebar } from './sidebar';
import { SidebarMenuRoute } from './sidebar/SidebarMenuRoute';
import { useSidebar } from './sidebar/SidebarProvider';
import { StartPageRedirect } from './StartPageRedirect';
import { Titlebar } from './Titlebar';

function NarrowNotSupported({
  redirectTo = '/budget',
  children,
}: {
  redirectTo?: string;
  children: ReactElement;
}) {
  const { isNarrowWidth } = useResponsive();
  const navigate = useNavigate();
  useEffect(() => {
    if (isNarrowWidth) {
      void navigate(redirectTo);
    }
  }, [isNarrowWidth, navigate, redirectTo]);
  return isNarrowWidth ? null : children;
}

function WideNotSupported({
  children,
  redirectTo = '/budget',
}: {
  redirectTo?: string;
  children: ReactElement;
}) {
  const { isNarrowWidth } = useResponsive();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNarrowWidth) {
      void navigate(redirectTo);
    }
  }, [isNarrowWidth, navigate, redirectTo]);
  return isNarrowWidth ? children : null;
}

function RouterBehaviors() {
  const location = useLocation();
  const href = useHref(location);
  useEffect(() => {
    undo.setUndoState('url', href);
  }, [href]);

  return null;
}

export function FinancesApp() {
  const { isNarrowWidth } = useResponsive();
  const sidebar = useSidebar();
  useMetaThemeColor(theme.mobileViewTheme);

  const location = useLocation();
  const dispatch = useDispatch();
  const { t } = useTranslation();

  useAutomaticBankSync();

  const init = useEffectEvent(() => {
    // Wait a little bit to make sure the sync button will get the
    // sync start event. This can be improved later.
    setTimeout(async () => {
      await dispatch(sync());
    }, 100);

    async function run() {
      await global.Actual.waitForUpdateReadyForDownload(); // This will only resolve when an update is ready
      dispatch(
        addNotification({
          notification: {
            type: 'message',
            title: t('A new version of Actual is available!'),
            message: t(
              'Click the button below to reload and apply the update.',
            ),
            sticky: true,
            id: 'update-reload-notification',
            button: {
              title: t('Update now'),
              action: async () => {
                await global.Actual.applyAppUpdate();
              },
            },
          },
        }),
      );
    }

    void run();
  });

  useEffect(() => init(), []);

  const scrollableRef = useRef<HTMLDivElement>(null);

  return (
    <View style={{ height: '100%' }}>
      <RouterBehaviors />
      <CommandBar />
      <ContextMenu />
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: theme.pageBackground,
          flex: 1,
        }}
      >
        <FloatableSidebar />

        <View
          style={{
            color: theme.pageText,
            backgroundColor: theme.pageBackground,
            flex: 1,
            overflow: 'hidden',
            width: '100%',
            // The wide layout has no header of its own to absorb the status
            // bar in the mobile apps (zero elsewhere); the narrow layout's
            // page header handles it.
            ...(!isNarrowWidth && {
              paddingTop: 'env(safe-area-inset-top)',
              paddingRight: 'env(safe-area-inset-right)',
              // A floating sidebar overlays this pane instead of sitting
              // beside it, so the pane itself reaches the left edge.
              ...(sidebar.floating && {
                paddingLeft: 'env(safe-area-inset-left)',
              }),
            }),
          }}
        >
          <ScrollProvider
            isDisabled={!isNarrowWidth}
            scrollableRef={scrollableRef}
          >
            <MobilePageHeaderProvider>
              <View
                ref={scrollableRef}
                style={{
                  flex: 1,
                  overflow: 'auto',
                  position: 'relative',
                }}
              >
                <Titlebar
                  style={{
                    WebkitAppRegion: 'drag',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                  }}
                />
                <Notifications />
                <BankSyncStatus />
                {isNarrowWidth && <MobilePageHeaderSlot />}

                <Routes>
                  <Route path="/" element={<StartPageRedirect />} />

                  <Route path="/reports/*" element={<Reports />} />
                  <Route path="/portfolio" element={<PortfolioPage />} />
                  <Route
                    path="/portfolio/:connectionId"
                    element={<PortfolioPage />}
                  />

                  <Route
                    path="/budget"
                    element={
                      <ErrorBoundary
                        FallbackComponent={FeatureErrorFallback}
                        resetKeys={[location.pathname]}
                      >
                        <NarrowAlternate name="Budget" />
                      </ErrorBoundary>
                    }
                  />

                  <Route
                    path="/schedules"
                    element={
                      <SidebarMenuRoute id="schedules">
                        <ErrorBoundary
                          FallbackComponent={FeatureErrorFallback}
                          resetKeys={[location.pathname]}
                        >
                          <NarrowAlternate name="Schedules" />
                        </ErrorBoundary>
                      </SidebarMenuRoute>
                    }
                  />
                  <Route
                    path="/schedules/:id"
                    element={
                      <ErrorBoundary
                        FallbackComponent={FeatureErrorFallback}
                        resetKeys={[location.pathname]}
                      >
                        <WideNotSupported>
                          <NarrowAlternate name="ScheduleEdit" />
                        </WideNotSupported>
                      </ErrorBoundary>
                    }
                  />

                  <Route
                    path="/payees/:id"
                    element={
                      <ErrorBoundary
                        FallbackComponent={FeatureErrorFallback}
                        resetKeys={[location.pathname]}
                      >
                        <WideNotSupported redirectTo="/settings/payees">
                          <NarrowAlternate name="PayeeEdit" />
                        </WideNotSupported>
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/rules/:id"
                    element={
                      <ErrorBoundary
                        FallbackComponent={FeatureErrorFallback}
                        resetKeys={[location.pathname]}
                      >
                        <WideNotSupported redirectTo="/settings/rules">
                          <NarrowAlternate name="RuleEdit" />
                        </WideNotSupported>
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/bank-sync/account/:accountId/edit"
                    element={
                      <ErrorBoundary
                        FallbackComponent={FeatureErrorFallback}
                        resetKeys={[location.pathname]}
                      >
                        <WideNotSupported redirectTo="/settings/bank-sync">
                          <MobileBankSyncAccountEditPage />
                        </WideNotSupported>
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/payees"
                    element={
                      <SidebarMenuRoute id="payees">
                        <ErrorBoundary
                          FallbackComponent={FeatureErrorFallback}
                          resetKeys={[location.pathname]}
                        >
                          <NarrowAlternate name="Payees" />
                        </ErrorBoundary>
                      </SidebarMenuRoute>
                    }
                  />
                  <Route
                    path="/tags/:id"
                    element={
                      <ErrorBoundary
                        FallbackComponent={FeatureErrorFallback}
                        resetKeys={[location.pathname]}
                      >
                        <WideNotSupported redirectTo="/settings/tags">
                          <NarrowAlternate name="TagEdit" />
                        </WideNotSupported>
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/tags"
                    element={
                      <SidebarMenuRoute id="tags">
                        <ErrorBoundary
                          FallbackComponent={FeatureErrorFallback}
                          resetKeys={[location.pathname]}
                        >
                          <NarrowAlternate name="Tags" />
                        </ErrorBoundary>
                      </SidebarMenuRoute>
                    }
                  />
                  <Route
                    path="/rules"
                    element={
                      <SidebarMenuRoute id="rules">
                        <ErrorBoundary
                          FallbackComponent={FeatureErrorFallback}
                          resetKeys={[location.pathname]}
                        >
                          <NarrowAlternate name="Rules" />
                        </ErrorBoundary>
                      </SidebarMenuRoute>
                    }
                  />
                  <Route
                    path="/bank-sync"
                    element={
                      <SidebarMenuRoute id="bank-sync">
                        <ErrorBoundary
                          FallbackComponent={FeatureErrorFallback}
                          resetKeys={[location.pathname]}
                        >
                          <NarrowAlternate name="BankSync" />
                        </ErrorBoundary>
                      </SidebarMenuRoute>
                    }
                  />
                  <Route path="/settings" element={<Settings />}>
                    <Route index element={<SettingsIndex />} />
                    <Route path="general" element={<GeneralSettings />} />
                    <Route
                      path="schedules"
                      element={
                        <SidebarMenuRoute id="schedules" isInSettings>
                          <ErrorBoundary
                            FallbackComponent={FeatureErrorFallback}
                            resetKeys={[location.pathname]}
                          >
                            <NarrowAlternate name="Schedules" />
                          </ErrorBoundary>
                        </SidebarMenuRoute>
                      }
                    />
                    <Route
                      path="payees"
                      element={
                        <SidebarMenuRoute id="payees" isInSettings>
                          <ErrorBoundary
                            FallbackComponent={FeatureErrorFallback}
                            resetKeys={[location.pathname]}
                          >
                            <NarrowAlternate name="Payees" />
                          </ErrorBoundary>
                        </SidebarMenuRoute>
                      }
                    />
                    <Route
                      path="tags"
                      element={
                        <SidebarMenuRoute id="tags" isInSettings>
                          <ErrorBoundary
                            FallbackComponent={FeatureErrorFallback}
                            resetKeys={[location.pathname]}
                          >
                            <NarrowAlternate name="Tags" />
                          </ErrorBoundary>
                        </SidebarMenuRoute>
                      }
                    />
                    <Route
                      path="rules"
                      element={
                        <SidebarMenuRoute id="rules" isInSettings>
                          <ErrorBoundary
                            FallbackComponent={FeatureErrorFallback}
                            resetKeys={[location.pathname]}
                          >
                            <NarrowAlternate name="Rules" />
                          </ErrorBoundary>
                        </SidebarMenuRoute>
                      }
                    />
                    <Route
                      path="bank-sync"
                      element={
                        <SidebarMenuRoute id="bank-sync" isInSettings>
                          <ErrorBoundary
                            FallbackComponent={FeatureErrorFallback}
                            resetKeys={[location.pathname]}
                          >
                            <NarrowAlternate name="BankSync" />
                          </ErrorBoundary>
                        </SidebarMenuRoute>
                      }
                    />
                    <Route path="advanced" element={<AdvancedSettings />} />
                    <Route
                      path="experimental"
                      element={<ExperimentalSettings />}
                    />
                  </Route>

                  <Route
                    path="/gocardless/link"
                    element={
                      <NarrowNotSupported>
                        <WideComponent name="GoCardlessLink" />
                      </NarrowNotSupported>
                    }
                  />

                  <Route
                    path="/enablebanking/auth_callback"
                    element={<EnableBankingCallback />}
                  />

                  <Route
                    path="/accounts"
                    element={
                      <ErrorBoundary
                        FallbackComponent={FeatureErrorFallback}
                        resetKeys={[location.pathname]}
                      >
                        <NarrowAlternate name="Accounts" />
                      </ErrorBoundary>
                    }
                  />

                  <Route
                    path="/accounts/:id"
                    element={
                      <ErrorBoundary
                        FallbackComponent={FeatureErrorFallback}
                        resetKeys={[location.pathname]}
                      >
                        <NarrowAlternate name="Account" />
                      </ErrorBoundary>
                    }
                  />

                  <Route
                    path="/transactions/:transactionId"
                    element={
                      <ErrorBoundary
                        FallbackComponent={FeatureErrorFallback}
                        resetKeys={[location.pathname]}
                      >
                        <WideNotSupported>
                          <TransactionEdit />
                        </WideNotSupported>
                      </ErrorBoundary>
                    }
                  />

                  <Route
                    path="/categories/:id"
                    element={
                      <ErrorBoundary
                        FallbackComponent={FeatureErrorFallback}
                        resetKeys={[location.pathname]}
                      >
                        <NarrowAlternate name="Category" />
                      </ErrorBoundary>
                    }
                  />
                  {/* redirect all other traffic to the budget page */}
                  <Route path="/*" element={<StartPageRedirect />} />
                </Routes>
              </View>

              <Routes>
                <Route path="/budget" element={<MobileNavTabs />} />
                <Route path="/accounts" element={<MobileNavTabs />} />
                <Route path="/settings/*" element={<MobileNavTabs />} />
                <Route path="/reports" element={<MobileNavTabs />} />
                <Route
                  path="/reports/:dashboardId"
                  element={<MobileNavTabs />}
                />
                <Route path="/schedules" element={<MobileNavTabs />} />
                <Route path="*" element={null} />
              </Routes>
            </MobilePageHeaderProvider>
          </ScrollProvider>
        </View>
      </View>
    </View>
  );
}
