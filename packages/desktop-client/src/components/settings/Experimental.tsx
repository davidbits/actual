import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import type { FeatureFlag } from '@actual-app/core/types/prefs';

import { Checkbox } from '#components/forms';
import { useFeatureFlag } from '#hooks/useFeatureFlag';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { useSyncServerStatus } from '#hooks/useSyncServerStatus';

import { SettingsGroup } from './SettingsGroup';
import { SettingsRow } from './SettingsRow';
import { StorageBackendToggle } from './StorageBackendToggle';

type FeatureToggleProps = {
  flag: FeatureFlag;
  disableToggle?: boolean;
  error?: ReactNode;
  children: ReactNode;
  note?: ReactNode;
  isSubFeature?: boolean;
  subFeatures?: ReactNode;
  onDisable?: () => void;
};

function FeatureToggle({
  flag: flagName,
  disableToggle = false,
  error,
  children,
  note,
  isSubFeature = false,
  subFeatures,
  onDisable,
}: FeatureToggleProps) {
  const enabled = useFeatureFlag(flagName);
  const [_, setFlagPref] = useSyncedPref(`flags.${flagName}`);
  const id = `settings-flag-${flagName}`;

  return (
    <SettingsRow
      htmlFor={id}
      title={children}
      isNested={isSubFeature}
      description={
        (note || (disableToggle && error)) && (
          <FeatureDetails note={note} error={disableToggle ? error : null} />
        )
      }
      control={
        <Checkbox
          id={id}
          checked={enabled}
          onChange={() => {
            setFlagPref(String(!enabled));
            if (enabled) {
              onDisable?.();
            }
          }}
          disabled={disableToggle}
          style={{ marginRight: 0 }}
        />
      }
    >
      {subFeatures}
    </SettingsRow>
  );
}

type FeatureDetailsProps = {
  note?: ReactNode;
  error?: ReactNode;
};

function FeatureDetails({ note, error }: FeatureDetailsProps) {
  return (
    <>
      {error && (
        <Text style={{ color: theme.errorText, fontWeight: 500 }}>
          {error}{' '}
        </Text>
      )}
      {note && <Text style={{ color: theme.warningText }}>{note}</Text>}
    </>
  );
}

export function ExperimentalFeatures() {
  const { t } = useTranslation();
  const goalTemplatesEnabled = useFeatureFlag('goalTemplatesEnabled');
  const [, setGoalTemplatesUIPref] = useSyncedPref(
    'flags.goalTemplatesUIEnabled',
  );
  const isUsingServer = useSyncServerStatus() !== 'no-server';

  return (
    <SettingsGroup
      title={t('Experimental features')}
      description={t(
        'These features are not fully tested and may not work as expected. THEY MAY CAUSE IRRECOVERABLE DATA LOSS. They may do nothing at all. Only enable them if you know what you are doing.',
      )}
    >
      <FeatureToggle
        flag="goalTemplatesEnabled"
        onDisable={() => setGoalTemplatesUIPref('false')}
        subFeatures={
          goalTemplatesEnabled && (
            <FeatureToggle
              flag="goalTemplatesUIEnabled"

              isSubFeature
            >
              <Trans>Budget automations UI</Trans>
            </FeatureToggle>
          )
        }
      >
        <Trans>Goal templates</Trans>
      </FeatureToggle>
      <FeatureToggle
        flag="actionTemplating"

        note={
          <Trans>
            Deprecated: this feature will be removed in a future release. Use
            Excel formula mode (Rule formulae) instead.
          </Trans>
        }
      >
        <Trans>Rule action templating</Trans>
      </FeatureToggle>
      <FeatureToggle flag="formulaMode">
        <Trans>Excel formula mode (Formula cards & Rule formulas)</Trans>
      </FeatureToggle>
      <FeatureToggle flag="currency">
        <Trans>Currency support</Trans>
      </FeatureToggle>
      <FeatureToggle flag="mobileCalculator">
        <Trans>Mobile calculator</Trans>
      </FeatureToggle>
      <FeatureToggle flag="newSidebarUI">
        <Trans>Redesigned sidebar</Trans>
      </FeatureToggle>
      <FeatureToggle flag="sankeyReport">
        <Trans>Sankey report</Trans>
      </FeatureToggle>
      <FeatureToggle flag="balanceForecastReport">
        <Trans>Balance Forecast Report</Trans>
      </FeatureToggle>
      <FeatureToggle flag="budgetAnalysisReport">
        <Trans>Budget Analysis Report</Trans>
      </FeatureToggle>
      <FeatureToggle flag="monteCarloReport">
        <Trans>Monte Carlo Analysis Report</Trans>
      </FeatureToggle>
      {isUsingServer && (
        <FeatureToggle flag="enableBanking">
          <Trans>Enable Banking sync (EU banks)</Trans>
        </FeatureToggle>
      )}
      <StorageBackendToggle />
    </SettingsGroup>
  );
}
